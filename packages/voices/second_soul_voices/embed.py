"""Embeddings plugáveis.

- 'tfidf'  : scikit-learn, offline, sem download. TF-IDF -> SVD (LSA) -> L2.
             Bom baseline pra separar temas; roda em segundos.
- 'sbert'  : sentence-transformers (modelo multilíngue). Semântica melhor,
             mas baixa ~2GB (torch) na primeira vez. Opcional.

Ambos devolvem uma matriz densa (n, d) normalizada, pronta pra clustering.
"""

from __future__ import annotations

import numpy as np


def embed(texts: list[str], backend: str = "tfidf", dims: int = 50) -> np.ndarray:
    if backend == "tfidf":
        return _tfidf(texts, dims)
    if backend == "sbert":
        return _sbert(texts)
    raise ValueError(f"backend desconhecido: {backend}")


def _tfidf(texts: list[str], dims: int) -> np.ndarray:
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import normalize

    vec = TfidfVectorizer(
        max_features=8000,
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,
    )
    X = vec.fit_transform(texts)

    # LSA: reduz dimensionalidade (clustering sofre em alta dimensão)
    n_comp = min(dims, X.shape[1] - 1, max(2, X.shape[0] - 1))
    if n_comp >= 2 and X.shape[1] > n_comp:
        svd = TruncatedSVD(n_components=n_comp, random_state=42)
        X = svd.fit_transform(X)
    else:
        X = X.toarray()
    return normalize(X)


def _sbert(texts: list[str]) -> np.ndarray:
    # import tardio: só exige o pacote se o usuário escolher este backend
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    emb = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return np.asarray(emb)
