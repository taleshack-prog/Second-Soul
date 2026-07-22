"""Filtro de ruído: remove boilerplate de IA e mensagens vazias/curtas.

Importante: por padrão NÃO removemos as mensagens do assistente. Numa memória
de estudos (ex.: conscienciologia), as respostas da IA guardam contexto que a
pessoa validou. Quem decide o que vira "voz" da pessoa é o pipeline de extração
downstream (que separa role=user de role=assistant), não este filtro.
"""

from __future__ import annotations

from ..schema import NormalizedItem

_BOILERPLATE = (
    "as an ai language model",
    "i'm an ai",
    "i am an ai",
    "como um modelo de linguagem",
    "sou uma inteligência artificial",
    "não posso ajudar com isso",
    "i cannot help with that",
)


class NoiseReducer:
    def __init__(self, min_chars: int = 2, drop_boilerplate: bool = True):
        self.min_chars = min_chars
        self.drop_boilerplate = drop_boilerplate

    def apply(self, items: list[NormalizedItem]) -> list[NormalizedItem]:
        out: list[NormalizedItem] = []
        for it in items:
            text = it.content.strip()
            if len(text) < self.min_chars:
                continue
            if self.drop_boilerplate:
                low = text.lower()
                if any(low.startswith(b) or b in low[:120] for b in _BOILERPLATE):
                    continue
            out.append(it)
        return out
