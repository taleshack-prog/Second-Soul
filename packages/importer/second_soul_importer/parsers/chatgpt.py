"""Parser do export oficial do ChatGPT.

O export (Settings -> Data Controls -> Export) chega como um ZIP contendo
`conversations.json`: uma LISTA de conversas. Cada conversa tem um `mapping`
(dict node_id -> node). Cada node tem opcionalmente `message` com:
  - author.role          -> user | assistant | system | tool
  - content.content_type -> "text", "multimodal_text", "code", ...
  - content.parts        -> lista (strings ou objetos)
  - create_time          -> epoch float

Aceitamos tanto o .zip quanto o conversations.json direto.
"""

from __future__ import annotations

import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from ..schema import NormalizedItem


class ChatGPTParser:
    source = "chatgpt"

    def parse(self, path: Path, user_id: str) -> list[NormalizedItem]:
        conversations = self._load(path)
        items: list[NormalizedItem] = []
        for conv in conversations:
            items.extend(self._parse_conversation(conv, user_id))
        return items

    # ---------- carga ----------
    #
    # Exports reais do ChatGPT variam:
    #   - conta pequena  -> um único `conversations.json`
    #   - conta grande   -> fatiado em `conversations-000.json`, `-001.json`, ...
    # Aceitamos: .zip (com um ou vários fragmentos), pasta extraída, ou qualquer
    # um dos fragmentos (nesse caso, puxamos os irmãos automaticamente).

    _CONV_RE = re.compile(r"conversations(-\d+)?\.json$", re.IGNORECASE)

    def _load(self, path: Path) -> list[dict[str, Any]]:
        if path.suffix.lower() == ".zip":
            texts = self._texts_from_zip(path)
        elif path.is_dir():
            texts = self._texts_from_dir(path)
        else:
            texts = self._texts_from_file(path)

        if not texts:
            raise ValueError("nenhum conversations*.json encontrado")

        return self._parse_texts(texts)

    def _texts_from_zip(self, path: Path) -> list[str]:
        out: list[str] = []
        with zipfile.ZipFile(path) as zf:
            names = sorted(n for n in zf.namelist() if self._CONV_RE.search(n))
            for n in names:
                out.append(zf.read(n).decode("utf-8", errors="ignore"))
        return out

    def _texts_from_dir(self, path: Path) -> list[str]:
        files = sorted(p for p in path.rglob("*.json") if self._CONV_RE.search(p.name))
        return [p.read_text(encoding="utf-8", errors="ignore") for p in files]

    def _texts_from_file(self, path: Path) -> list[str]:
        # Se for um fragmento (conversations-00X.json) e houver irmãos, puxa todos.
        if self._CONV_RE.search(path.name):
            siblings = sorted(
                p for p in path.parent.glob("*.json") if self._CONV_RE.search(p.name)
            )
            if len(siblings) > 1:
                return [p.read_text(encoding="utf-8", errors="ignore") for p in siblings]
        return [path.read_text(encoding="utf-8", errors="ignore")]

    def _parse_texts(self, texts: list[str]) -> list[dict[str, Any]]:
        """Cada fragmento costuma ser um array JSON válido e independente.

        Se algum não for (raro: array quebrado entre fragmentos), tentamos
        concatenar tudo e parsear de uma vez como fallback."""
        convs: list[dict[str, Any]] = []
        broken = False
        for t in texts:
            try:
                convs.extend(self._to_conv_list(json.loads(t)))
            except json.JSONDecodeError:
                broken = True
        if broken and not convs:
            convs.extend(self._to_conv_list(json.loads("".join(texts))))
        return convs

    @staticmethod
    def _to_conv_list(data: Any) -> list[dict[str, Any]]:
        if isinstance(data, dict) and "conversations" in data:
            return data["conversations"]
        if isinstance(data, list):
            return data
        if isinstance(data, dict):  # uma conversa solta
            return [data]
        return []

    # ---------- parsing de uma conversa ----------

    def _parse_conversation(
        self, conv: dict[str, Any], user_id: str
    ) -> list[NormalizedItem]:
        conv_id = conv.get("conversation_id") or conv.get("id") or ""
        title = conv.get("title") or ""
        mapping = conv.get("mapping") or {}

        rows: list[NormalizedItem] = []
        for node in mapping.values():
            msg = node.get("message") if isinstance(node, dict) else None
            if not msg:
                continue

            role = (msg.get("author") or {}).get("role", "unknown")
            text = self._extract_text(msg.get("content") or {})
            if not text.strip():
                continue

            rows.append(
                NormalizedItem(
                    user_id=user_id,
                    content=text.strip(),
                    content_type="message",
                    source=self.source,
                    role=role,
                    conversation_id=conv_id,
                    file_name=title,
                    timestamp=self._ts(msg.get("create_time")),
                )
            )
        return rows

    @staticmethod
    def _extract_text(content: dict[str, Any]) -> str:
        parts: Iterable[Any] = content.get("parts") or []
        chunks: list[str] = []
        for p in parts:
            if isinstance(p, str):
                chunks.append(p)
            elif isinstance(p, dict):
                # multimodal: pega texto se houver, ignora imagens/áudio aqui
                if "text" in p:
                    chunks.append(str(p["text"]))
        return "\n".join(chunks)

    @staticmethod
    def _ts(epoch: Any) -> datetime | None:
        if not epoch:
            return None
        try:
            return datetime.fromtimestamp(float(epoch), tz=timezone.utc)
        except (ValueError, OSError, OverflowError):
            return None
