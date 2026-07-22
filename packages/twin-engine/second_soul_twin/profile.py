"""Perfil — a verdade DECLARADA pela pessoa (curada, consentida).

Formato híbrido: campos sugeridos como convite, todos opcionais, todos texto
livre. Três tipos:
  - credential : injetado em TODA resposta (a autoridade viaja com a voz).
  - style      : calibra o tom/registro do gêmeo.
  - topical    : entra na recuperação com peso maior que os chats.

Verdade declarada > verdade inferida: o gêmeo pesa o perfil acima dos chats.
Mas os dois juntos é que fazem o gêmeo soar humano — perfil dá intenção e
credencial; chats dão a textura e a verdade involuntária.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

# peso de recuperação dos itens de perfil (chats = 1.0)
PROFILE_WEIGHT = 1.6

FIELDS: list[dict[str, str]] = [
    {"key": "profissao", "label": "Profissão e formação", "kind": "credential",
     "prompt": "Sua formação e ofício — a autoridade que embasa o que você diz."},
    {"key": "tom", "label": "Como eu me expresso", "kind": "style",
     "prompt": "Seu jeito de falar: direto ou acolhedor, técnico ou poético, seco ou caloroso."},
    {"key": "ideologia", "label": "Ideologia e valores", "kind": "topical",
     "prompt": "O que você defende, o que orienta suas escolhas."},
    {"key": "religiao", "label": "Religião e espiritualidade", "kind": "topical",
     "prompt": "Sua fé, prática ou visão espiritual — como quiser."},
    {"key": "filosofia", "label": "Filosofia de vida", "kind": "topical",
     "prompt": "Como você entende a existência, o sentido, o certo e o errado."},
    {"key": "estudos", "label": "Estudos e áreas de interesse", "kind": "topical",
     "prompt": "O que você estuda, pesquisa, se aprofunda."},
    {"key": "hobbies", "label": "Hobbies e paixões", "kind": "topical",
     "prompt": "O que você faz por prazer."},
    {"key": "musica", "label": "Música", "kind": "topical",
     "prompt": "O que você ouve, o que te marca."},
    {"key": "artes", "label": "Artes", "kind": "topical",
     "prompt": "O que você aprecia ou cria."},
    {"key": "livros", "label": "Livros que me formaram", "kind": "topical",
     "prompt": "As leituras que te construíram."},
    {"key": "pensamentos", "label": "Pensamentos e reflexões", "kind": "topical",
     "prompt": "O que você pensa e quer que fique registrado, com suas palavras."},
]

_KIND = {f["key"]: f["kind"] for f in FIELDS}
_LABEL = {f["key"]: f["label"] for f in FIELDS}
_SENT = re.compile(r"(?<=[.!?])\s+")


def template() -> dict[str, Any]:
    """Modelo em branco pra pessoa preencher só o que quiser."""
    return {"name": "", "fields": {f["key"]: "" for f in FIELDS}}


def load_profile(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def profile_to_items(profile: dict[str, Any]) -> list[dict[str, Any]]:
    """Campos topicais/credencial viram itens de recuperação (com peso)."""
    items: list[dict[str, Any]] = []
    for key, content in (profile.get("fields") or {}).items():
        content = (content or "").strip()
        if not content or _KIND.get(key) == "style":
            continue  # 'tom' não é recuperável; guia a geração
        for chunk in _chunks(content):
            items.append({
                "content": chunk,
                "role": "user",
                "source": "profile",
                "field": key,
                "file_name": f"Perfil · {_LABEL.get(key, key)}",
                "weight": PROFILE_WEIGHT,
            })
    return items


def summaries(profile: dict[str, Any]) -> dict[str, str]:
    """Textos injetados na geração: credencial (sempre) e tom (registro)."""
    fields = profile.get("fields") or {}
    cred = " ".join(
        v.strip() for k, v in fields.items()
        if _KIND.get(k) == "credential" and (v or "").strip()
    )
    style = " ".join(
        v.strip() for k, v in fields.items()
        if _KIND.get(k) == "style" and (v or "").strip()
    )
    return {"credential": cred, "style": style}


def _chunks(text: str, max_len: int = 300) -> list[str]:
    """Quebra por frase pra granularidade de recuperação; junta curtas."""
    sents = [s.strip() for s in _SENT.split(text) if s.strip()]
    out, buf = [], ""
    for s in sents:
        if len(buf) + len(s) <= max_len:
            buf = f"{buf} {s}".strip()
        else:
            if buf:
                out.append(buf)
            buf = s
    if buf:
        out.append(buf)
    return out or [text.strip()]
