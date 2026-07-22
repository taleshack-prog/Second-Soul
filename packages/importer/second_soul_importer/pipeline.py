"""Pipeline de ingestão: detecta -> parseia -> filtra -> normaliza.

Escopo desta versão (Sprint 1): ChatGPT (.zip / .json). A arquitetura de
gateway universal (WhatsApp, e-mail, mídia, etc.) da spec entra em sprints
seguintes plugando novos parsers no dict `_PARSERS` — o resto do pipeline não
muda, porque tudo já sai como NormalizedItem.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .filters import Deduplicator, NoiseReducer, PIIScanner
from .parsers import ChatGPTParser
from .schema import NormalizedItem

_PARSERS = {
    "chatgpt": ChatGPTParser,
}


class ImportPipeline:
    def __init__(self, user_id: str, pii_level: str = "strict"):
        self.user_id = user_id
        self.filters = [
            NoiseReducer(),
            Deduplicator(),
            PIIScanner(level=pii_level),
        ]

    # ---------- API pública ----------

    def run(self, file_path: str | Path, platform: str = "auto") -> dict[str, Any]:
        return self.run_staged(file_path, platform=platform)

    def run_staged(
        self,
        file_path: str | Path,
        platform: str = "auto",
        on_stage=None,
    ) -> dict[str, Any]:
        """Mesmo pipeline, reportando ETAPAS REAIS via callback.

        on_stage(stage: str, info: dict) é chamado ao concluir cada etapa —
        nada de porcentagem inventada: cada etapa acende quando de fato ocorre.
        """
        def emit(stage: str, **info):
            if on_stage:
                on_stage(stage, info)

        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(path)

        emit("detectando")
        platform = self._detect(path) if platform == "auto" else platform
        parser_cls = _PARSERS.get(platform)
        if parser_cls is None:
            raise ValueError(
                f"plataforma '{platform}' ainda sem parser "
                f"(disponíveis: {sorted(_PARSERS)})"
            )

        emit("lendo", platform=platform)
        raw = parser_cls().parse(path, self.user_id)
        emit("lido", raw_count=len(raw))

        clean = raw
        stage_names = {
            "NoiseReducer": "limpando",
            "Deduplicator": "deduplicando",
            "PIIScanner": "protegendo",
        }
        for f in self.filters:
            name = stage_names.get(f.__class__.__name__, f.__class__.__name__.lower())
            emit(name, remaining=len(clean))
            clean = f.apply(clean)

        emit("concluido", clean_count=len(clean))

        return {
            "status": "success",
            "user_id": self.user_id,
            "platform": platform,
            "file": path.name,
            "raw_count": len(raw),
            "clean_count": len(clean),
            "scrubbed_count": sum(1 for i in clean if i.pii_scrubbed),
            "by_role": self._counts_by_role(clean),
            "items": clean,
        }

    # ---------- detecção ----------

    def _detect(self, path: Path) -> str:
        """Heurística leve para JSON; ZIP do ChatGPT é detectado pelo conteúdo."""
        if path.suffix.lower() == ".zip":
            return "chatgpt"
        if path.is_dir():
            # pasta de export extraído: contém conversations*.json
            if any(
                re.search(r"conversations(-\d+)?\.json$", p.name, re.IGNORECASE)
                for p in path.rglob("*.json")
            ):
                return "chatgpt"
            return "unknown"
        try:
            with path.open("r", encoding="utf-8", errors="ignore") as fh:
                head = fh.read(20000)
            data = json.loads(head)
            sample = data[0] if isinstance(data, list) and data else data
            if isinstance(sample, dict) and "mapping" in sample:
                return "chatgpt"
        except (json.JSONDecodeError, OSError, IndexError):
            pass
        return "unknown"

    @staticmethod
    def _counts_by_role(items: list[NormalizedItem]) -> dict[str, int]:
        out: dict[str, int] = {}
        for it in items:
            out[it.role or "unknown"] = out.get(it.role or "unknown", 0) + 1
        return out
