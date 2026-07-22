"""Filtro por tema semeado — isola a essência de UMA pessoa por domínio.

Quando o operador CONHECE a conta (ex.: "a essência da minha mãe é tudo que é
conscienciologia"), não precisamos adivinhar pessoas por clustering. O operador
dá termos-semente do domínio; pontuamos cada fala pela proximidade semântica à
semente e ficamos com as relevantes.

Mais robusto que clustering cego: usa o conhecimento do operador, é transparente
(dá pra ver a distribuição de score e ajustar o corte), e não depende de acertar
o número de pessoas.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from .separate import load_user_messages


def filter_by_seed(
    jsonl_path: str | Path,
    seed: str,
    backend: str = "tfidf",
    threshold: float | None = None,
    top_k: int | None = None,
    min_words: int = 4,
) -> dict[str, Any]:
    rows = load_user_messages(jsonl_path, min_words=min_words)
    if not rows:
        return {"status": "empty", "reason": "nenhuma fala de usuário com sinal"}

    texts = [r["content"] for r in rows]
    scores = _score(texts, seed, backend)

    # distribuição de score em cortes úteis, pra o operador calibrar
    grid = {round(t, 2): int(np.sum(scores >= t)) for t in np.arange(0.05, 0.51, 0.05)}

    order = np.argsort(-scores)
    if top_k is not None:
        keep_idx = order[:top_k].tolist()
        used = f"top_k={top_k}"
    else:
        tau = threshold if threshold is not None else _auto_threshold(scores)
        keep_idx = [i for i in order if scores[i] >= tau]
        used = f"threshold={round(float(tau),3)}"

    kept = [rows[i] for i in keep_idx]
    samples = [texts[i][:200] for i in keep_idx[:5]]
    # borderline: logo abaixo do corte, pra o operador ver o que está deixando de fora
    below = [i for i in order if i not in set(keep_idx)][:5]
    borderline = [f"({scores[i]:.2f}) {texts[i][:120]}" for i in below]

    return {
        "status": "success",
        "backend": backend,
        "seed": seed,
        "total_user_messages": len(rows),
        "kept": len(kept),
        "criterion": used,
        "score_distribution": grid,
        "samples_kept": samples,
        "borderline_excluded": borderline,
        "kept_rows": kept,
    }


def _score(texts: list[str], seed: str, backend: str) -> np.ndarray:
    if backend == "sbert":
        from sentence_transformers import SentenceTransformer, util

        model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        emb = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        seed_emb = model.encode([seed], normalize_embeddings=True)
        return util.cos_sim(seed_emb, emb).cpu().numpy()[0]

    # TF-IDF: recuperação clássica por consulta (offline)
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    vec = TfidfVectorizer(max_features=8000, ngram_range=(1, 2), sublinear_tf=True)
    X = vec.fit_transform(texts)
    q = vec.transform([seed])
    return cosine_similarity(q, X)[0]


def _auto_threshold(scores: np.ndarray) -> float:
    """Sem corte informado: usa a mediana dos scores positivos como piso suave."""
    pos = scores[scores > 0]
    if len(pos) == 0:
        return 0.05
    return float(np.median(pos))
