"""Schema universal — tudo que entra no Second Soul vira um NormalizedItem.

Corrige dois bugs da spec original:
  1. Campos sem default (ex. `checksum`) vinham DEPOIS de campos com default,
     o que gera `TypeError: non-default argument follows default argument`.
     Aqui usamos `field(default_factory=...)` e ordenamos corretamente.
  2. `imported_at: datetime = datetime.utcnow()` era avaliado UMA vez na
     definição da classe (todos os itens ganhavam o mesmo timestamp).
     Trocado por `default_factory`.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def sha256_of(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass
class NormalizedItem:
    """Contrato universal. Todo parser, de qualquer fonte, produz isto."""

    # --- Identificação (obrigatórios) ---
    user_id: str
    content: str          # sempre texto após extração
    content_type: str     # text, audio, video, image, code, email, message...
    source: str           # chatgpt, whatsapp, email, kindle, raw...

    # --- Origem / proveniência ---
    file_name: str = ""
    role: str | None = None          # user | assistant | system | other
    conversation_id: str | None = None

    # --- Extrações derivadas ---
    transcription: str | None = None  # áudio/vídeo
    ocr_text: str | None = None       # imagens

    # --- Metadados enriquecidos ---
    timestamp: datetime | None = None
    language: str | None = None
    sentiment: dict[str, float] | None = None
    topics: list[str] | None = None
    entities: list[str] | None = None

    # --- Embeddings (populado no pipeline de ML, não aqui) ---
    embedding: list[float] | None = None
    embedding_model: str | None = None

    # --- Privacidade ---
    pii_scrubbed: bool = False
    classification: str = "general"   # general | sensitive | medical | financial

    # --- Controle (default_factory: avaliado por item) ---
    checksum: str = ""
    imported_at: datetime = field(default_factory=_utcnow)

    def __post_init__(self) -> None:
        if not self.checksum:
            self.checksum = sha256_of(self.content)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for k in ("timestamp", "imported_at"):
            if isinstance(d.get(k), datetime):
                d[k] = d[k].isoformat()
        return d
