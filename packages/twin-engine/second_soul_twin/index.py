"""Índice vetorial local do gêmeo.

Sem servidor, sem pgvector: as memórias dela ficam num diretório na SUA máquina
(embeddings + textos). Para o volume da validação (centenas a milhares de
falas), busca por cosseno em memória é instantânea.

Backends:
  - 'tfidf': offline, sem download. Bom pra validar a recuperação já.
  - 'sbert': neural multilíngue (baixa ~2GB 1x). Recupera por SIGNIFICADO —
             acha "a consciência continua após o corpo" mesmo sem a palavra
             "consciex". É o backend recomendado pro gêmeo.
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any

import numpy as np

_SBERT_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"


class TwinIndex:
    def __init__(self, backend: str = "sbert"):
        self.backend = backend
        self.meta: list[dict[str, Any]] = []
        self.weights: np.ndarray | None = None    # peso de recuperação por item
        self.profile: dict = {}                   # {credential, style, album:[titulos]}
        self._emb: np.ndarray | None = None      # sbert
        self._vectorizer = None                   # tfidf
        self._matrix = None                       # tfidf
        self._model = None                        # sbert (lazy)

    # ---------- construção ----------

    def build(self, rows: list[dict[str, Any]],
              profile: dict[str, str] | None = None) -> "TwinIndex":
        self.meta = rows
        self.profile = profile or {}
        # peso por item: perfil vem com weight>1; chats assumem 1.0
        self.weights = np.array([float(r.get("weight", 1.0)) for r in rows])
        texts = [r["content"] for r in rows]
        if self.backend == "sbert":
            self._emb = self._encode(texts)
        elif self.backend == "tfidf":
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.preprocessing import normalize
            self._vectorizer = TfidfVectorizer(
                max_features=12000, ngram_range=(1, 2), sublinear_tf=True
            )
            self._matrix = normalize(self._vectorizer.fit_transform(texts))
        else:
            raise ValueError(f"backend desconhecido: {self.backend}")
        return self

    # ---------- consulta ----------

    def query(self, text: str, k: int = 6) -> list[dict[str, Any]]:
        if self.backend == "sbert":
            q = self._encode([text])[0]
            sims = self._emb @ q
        else:
            from sklearn.metrics.pairwise import cosine_similarity
            q = self._vectorizer.transform([text])
            sims = cosine_similarity(q, self._matrix)[0]

        # verdade declarada (perfil) pesa mais que a inferida (chats)
        boosted = sims * self.weights if self.weights is not None else sims
        order = list(np.argsort(-boosted))

        # assento garantido para o que a pessoa DECLAROU: sem isso, cronicas
        # longas vencem sempre a disputa com campos curtos de perfil.
        is_profile = [m.get("source") == "profile" for m in self.meta]
        chosen = []
        if any(is_profile):
            for i in order:
                if is_profile[i] and len(chosen) < 2:
                    chosen.append(i)
                if len(chosen) >= 2:
                    break
        for i in order:
            if len(chosen) >= k:
                break
            if i not in chosen:
                chosen.append(i)
        chosen.sort(key=lambda i: -boosted[i])

        top = chosen
        return [
            {"score": float(sims[i]), "boosted": float(boosted[i]),
             "content": self.meta[i]["content"],
             "source": self.meta[i].get("source", "chat"),
             "file_name": self.meta[i].get("file_name", ""),
             "timestamp": self.meta[i].get("timestamp")}
            for i in top
        ]

    # ---------- persistência ----------

    def save(self, path: str | Path) -> None:
        d = Path(path)
        d.mkdir(parents=True, exist_ok=True)
        (d / "meta.json").write_text(
            json.dumps({"backend": self.backend, "rows": self.meta,
                        "profile": self.profile}, ensure_ascii=False),
            encoding="utf-8",
        )
        if self.backend == "sbert":
            np.save(d / "emb.npy", self._emb)
        else:
            with open(d / "tfidf.pkl", "wb") as fh:
                pickle.dump({"vectorizer": self._vectorizer, "matrix": self._matrix}, fh)

    @classmethod
    def load(cls, path: str | Path) -> "TwinIndex":
        d = Path(path)
        blob = json.loads((d / "meta.json").read_text(encoding="utf-8"))
        idx = cls(backend=blob["backend"])
        idx.meta = blob["rows"]
        idx.profile = blob.get("profile", {})
        idx.weights = np.array([float(r.get("weight", 1.0)) for r in idx.meta])
        if idx.backend == "sbert":
            idx._emb = np.load(d / "emb.npy")
        else:
            with open(d / "tfidf.pkl", "rb") as fh:
                obj = pickle.load(fh)
            idx._vectorizer, idx._matrix = obj["vectorizer"], obj["matrix"]
        return idx

    # ---------- sbert ----------

    def _encode(self, texts: list[str]) -> np.ndarray:
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(_SBERT_MODEL)
        return np.asarray(
            self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        )
