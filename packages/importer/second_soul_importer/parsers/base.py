"""Contrato base para parsers de plataforma."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from ..schema import NormalizedItem


class Parser(Protocol):
    """Todo parser recebe um arquivo e devolve NormalizedItems."""

    source: str

    def parse(self, path: Path, user_id: str) -> list[NormalizedItem]: ...
