"""Deduplicação por checksum SHA-256 do conteúdo (exata).

Fuzzy/near-dup (MinHash, embeddings) fica para o pipeline de ML, onde já
existem vetores. Aqui resolvemos o caso comum e barato: mensagens idênticas
repetidas (reenvios, cópias de contexto)."""

from __future__ import annotations

from ..schema import NormalizedItem


class Deduplicator:
    def apply(self, items: list[NormalizedItem]) -> list[NormalizedItem]:
        seen: set[str] = set()
        out: list[NormalizedItem] = []
        for it in items:
            if it.checksum in seen:
                continue
            seen.add(it.checksum)
            out.append(it)
        return out
