"""PII Scanner — três níveis (strict / balanced / minimal), foco BR + LGPD.

Regex resolve o caso 80/20 (CPF, cartão, telefone, e-mail, CEP). Para produção,
acoplar um modelo NER (ex.: presidio/spaCy) como segunda passada — deixamos o
ponto de extensão marcado. Aqui o objetivo é: nada sensível óbvio entra sem o
usuário ter escolhido o nível.
"""

from __future__ import annotations

import re

from ..schema import NormalizedItem

Level = str  # "strict" | "balanced" | "minimal"

_PATTERNS = {
    "cpf": re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"),
    "card": re.compile(r"\b(?:\d[ -]?){13,16}\b"),
    "phone_br": re.compile(r"\b(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b"),
    "email": re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),
    "cep": re.compile(r"\b\d{5}-?\d{3}\b"),
    "password_kv": re.compile(
        r"(?i)\b(senha|password|token|api[_-]?key)\b\s*[:=]\s*\S+"
    ),
}

# O que cada nível remove
_LEVELS: dict[Level, set[str]] = {
    "strict":   {"cpf", "card", "phone_br", "email", "cep", "password_kv"},
    "balanced": {"cpf", "card", "password_kv"},
    "minimal":  {"card", "password_kv"},
}


class PIIScanner:
    def __init__(self, level: Level = "strict"):
        if level not in _LEVELS:
            raise ValueError(f"nível PII inválido: {level}")
        self.level = level
        self._active = {k: v for k, v in _PATTERNS.items() if k in _LEVELS[level]}

    def apply(self, items: list[NormalizedItem]) -> list[NormalizedItem]:
        for it in items:
            scrubbed, hit = self._scrub(it.content)
            if hit:
                it.content = scrubbed
                it.pii_scrubbed = True
                if it.classification == "general":
                    it.classification = "sensitive"
        return items

    def _scrub(self, text: str) -> tuple[str, bool]:
        hit = False
        for name, pat in self._active.items():
            text, n = pat.subn(f"[{name.upper()}_REMOVIDO]", text)
            hit = hit or n > 0
        return text, hit
