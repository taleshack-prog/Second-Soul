"""Encontra vozes (pessoas) numa conta — pipeline de dois estágios.

Descoberta empírica (ver ANALISE-VOZES.md):
  - clustering semântico separa TEMA, não pessoa -> super-segmenta, mas puro.
  - estilo (frase, gíria, código) ~ pessoa -> funde os temas na pessoa certa.
  - o NÚMERO de pessoas não é confiável por silhouette; o "maior salto" no
    dendrograma das assinaturas de estilo é estável.
  - mensagens neutras/curtas não têm assinatura -> marcadas como AMBÍGUAS
    (baixa confiança) pra não contaminar o gêmeo.
"""

from __future__ import annotations

import numpy as np


def find_voices(V: np.ndarray, S: np.ndarray, max_voices: int = 6) -> dict:
    from scipy.cluster.hierarchy import fcluster, linkage
    from sklearn.cluster import KMeans

    n = V.shape[0]
    if n < 8:
        return {"labels": np.zeros(n, dtype=int), "n_voices": 1, "confidence": np.ones(n)}

    # estágio 1: super-agrupa por tema
    k_fine = int(min(12, max(3, n // 8)))
    fine = KMeans(n_clusters=k_fine, random_state=42, n_init=10).fit_predict(V)
    fine_ids = sorted(set(int(x) for x in fine))

    sig = np.array([S[[i for i, l in enumerate(fine) if l == c]].mean(0) for c in fine_ids])
    if len(sig) < 2:
        return {"labels": np.zeros(n, dtype=int), "n_voices": 1, "confidence": np.ones(n)}

    # estágio 2: funde por estilo; nº de vozes pelo maior salto
    Z = linkage(sig, method="ward")
    gaps = np.diff(Z[:, 2])
    n_voices = int(min(max_voices, max(1, len(sig) - int(np.argmax(gaps)) - 1)))

    if n_voices <= 1:
        return {"labels": np.zeros(n, dtype=int), "n_voices": 1,
                "confidence": np.ones(n), "fine_k": k_fine}

    merged_fine = fcluster(Z, t=n_voices, criterion="maxclust")
    remap = {c: int(merged_fine[i]) - 1 for i, c in enumerate(fine_ids)}
    labels = np.array([remap[int(l)] for l in fine])

    conf = _confidence(V, S, labels)
    return {"labels": labels, "n_voices": len(set(labels)), "confidence": conf, "fine_k": k_fine}


def _confidence(V: np.ndarray, S: np.ndarray, labels: np.ndarray) -> np.ndarray:
    """Margem: quão mais perto a mensagem está da sua voz vs. da rival."""
    X = np.hstack([V, S * 1.5])
    voices = sorted(set(int(l) for l in labels))
    centroids = {v: X[labels == v].mean(0) for v in voices}
    conf = np.zeros(len(X))
    for i, x in enumerate(X):
        dists = {v: float(np.linalg.norm(x - c)) for v, c in centroids.items()}
        own = dists[int(labels[i])]
        others = [d for v, d in dists.items() if v != labels[i]]
        rival = min(others) if others else own + 1e-9
        conf[i] = (rival - own) / (rival + own + 1e-9)
    return conf
