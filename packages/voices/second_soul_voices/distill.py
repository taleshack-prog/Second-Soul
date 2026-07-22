"""Destilação de essência — separa REFLEXÃO de comando e de prosa de livro.

Objetivo (definido pelo operador): manter a voz dela PENSANDO, não a editora do
livro nem o texto formal. Três sinais:

  - COMANDO de edição  ("quero trocar a palavra", "formata em word")  -> descarta
  - PROSA de livro      ("Definologia. O pensene é...")               -> rebaixa
  - REFLEXÃO 1ª pessoa  ("penso que...", "foi meu neto que me mostrou")-> mantém

Heurística transparente e ajustável (o operador calibra o corte). Quando a
mensagem é "comando - conteúdo", tenta extrair o conteúdo depois do travessão.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_CMD = re.compile(
    r"^\s*(quero|troca|trocar|muda|mudar|formata|formatar|revisa|revisar|"
    r"acrescenta|acrescentar|substitu\w*|melhora|melhorar|coloca|colocar|"
    r"tira|tirar|baixa|baixar|corrige|corrigir|ajusta|ajustar|deixa|p[oõ]e|"
    r"inclui|incluir|resume|resumir|traduz|traduzir|escreve|escrever|faz|fazer)\b",
    re.IGNORECASE,
)
_FORMAT = re.compile(
    r"\b(word|justificad\w+|pdf|em preto|par[áa]grafo|cap[íi]tulo|artigo|verbete|"
    r"negrito|it[áa]lico|fonte|t[íi]tulo|baixar|coletânea)\b",
    re.IGNORECASE,
)
_BOOKDEF = re.compile(
    r"^\s*(defin(ologia|i[çc][ãa]o)|teoriologia|sinon[íi]mia|anton[íi]mia|"
    r"fatologia|casu[íi]stica|remissiologia|bibliografia|etimologia)\b",
    re.IGNORECASE,
)
_FIRST = re.compile(
    r"\b(penso|acho|acredito|sinto|percebo|reconhe[çc]o|aprendi|entendo|vejo|"
    r"creio|imagino|lembro|vivi|senti|gosto|prefiro|defendo)\b",
    re.IGNORECASE,
)
_NARR = re.compile(
    r"\b(meu neto|minha vida|meu filho|minha filha|minha mãe|meu pai|"
    r"quando eu|comigo|na minha|minha experiência|me mostrou|me fez)\b",
    re.IGNORECASE,
)
_STANCE = re.compile(
    r"(temos que|devemos|precisamos|importa (?:perguntar|entender|falar)|"
    r"penso que|acredito que|na verdade|o que importa)",
    re.IGNORECASE,
)
_DASH = re.compile(r"\s[-–—:]\s")


def _clean(text: str) -> str:
    """Se começa com comando e tem 'comando - conteúdo', devolve o conteúdo."""
    if _CMD.match(text):
        m = _DASH.search(text)
        if m:
            return text[m.end():].strip()
    return text.strip()


def reflection_score(text: str) -> tuple[float, str]:
    cleaned = _clean(text)
    score = 0.0
    score += 2 * len(_FIRST.findall(cleaned))
    score += 3 * len(_NARR.findall(cleaned))
    score += 2 * len(_STANCE.findall(cleaned))
    # penalidades olham o texto ORIGINAL (intenção de comando/formatação)
    if _CMD.match(text):
        score -= 3
    score -= 2 * len(_FORMAT.findall(text))
    if _BOOKDEF.match(cleaned):
        score -= 4
    return score, cleaned


def distill(
    jsonl_path: str | Path, threshold: float = 1.0, min_words: int = 4
) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    with open(jsonl_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            if obj.get("role") != "user":
                continue
            if len((obj.get("content") or "").split()) < min_words:
                continue
            rows.append(obj)

    scored = []
    for r in rows:
        s, cleaned = reflection_score(r["content"])
        scored.append((s, cleaned, r))
    scored.sort(key=lambda x: -x[0])

    kept = [(s, c, r) for s, c, r in scored if s >= threshold]
    grid = {
        t: sum(1 for s, _, _ in scored if s >= t)
        for t in (-2, -1, 0, 1, 2, 3, 5, 8)
    }

    out_rows = []
    for s, cleaned, r in kept:
        nr = dict(r)
        nr["content"] = cleaned          # texto destilado (sem wrapper de comando)
        nr["reflection_score"] = s
        out_rows.append(nr)

    return {
        "status": "success",
        "total_user_messages": len(rows),
        "kept": len(kept),
        "threshold": threshold,
        "score_distribution": grid,
        "top_reflections": [c[:200] for _, c, _ in scored[:6]],
        "dropped_examples": [c[:120] for _, c, _ in scored[-6:]],
        "kept_rows": out_rows,
    }
