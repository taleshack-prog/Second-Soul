"""Separação de vozes — orquestra o pipeline completo.

Entrada: o .jsonl do importer. Saída: vozes (pessoas) com amostras, termos e
estilo, mais a contagem de falas ambíguas (baixa confiança). Opera só nas
mensagens role="user" (a voz humana).
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np

from . import features
from .cluster import find_voices
from .embed import embed
from sklearn.preprocessing import StandardScaler

_WORD = re.compile(r"[a-zA-ZáàâãéêíóôõúçñÁÀÂÃÉÊÍÓÔÕÚÇÑ]{3,}", re.UNICODE)
_STOP = set(
    "que para com uma como mais mas por sua seu dos das você voce nao não isso "
    "então entao aqui está esta esse essa este muito bem sim tudo pra pro sobre "
    "the and for you that this with have http https www".split()
)


def load_user_messages(jsonl_path: str | Path, min_words: int = 4) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with open(jsonl_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            if obj.get("role") != "user":
                continue
            content = (obj.get("content") or "").strip()
            if len(content.split()) < min_words:
                continue
            rows.append(obj)
    return rows


def separate(
    jsonl_path: str | Path,
    backend: str = "tfidf",
    min_words: int = 4,
    max_messages: int = 4000,
    confidence_threshold: float = 0.05,
) -> dict[str, Any]:
    rows = load_user_messages(jsonl_path, min_words=min_words)
    if not rows:
        return {"status": "empty", "reason": "nenhuma fala de usuário com sinal suficiente"}

    sampled = rows
    if len(rows) > max_messages:
        idx = np.linspace(0, len(rows) - 1, max_messages).astype(int)
        sampled = [rows[i] for i in idx]

    texts = [r["content"] for r in sampled]
    V = embed(texts, backend=backend)
    S = StandardScaler().fit_transform([features.extract(t).vector() for t in texts])

    res = find_voices(V, S)
    labels, conf = res["labels"], res["confidence"]

    voices = _summarize(texts, labels, conf, confidence_threshold)
    ambiguous = int(np.sum(conf < confidence_threshold))

    return {
        "status": "success",
        "backend": backend,
        "total_user_messages": len(rows),
        "analyzed": len(sampled),
        "voices_found": res["n_voices"],
        "ambiguous_low_confidence": ambiguous,
        "confidence_threshold": confidence_threshold,
        "voices": voices,
    }


def _summarize(texts, labels, conf, tau) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for vid in sorted(set(int(l) for l in labels)):
        idx = [i for i, l in enumerate(labels) if l == vid]
        confident = [i for i in idx if conf[i] >= tau]
        group = [texts[i] for i in idx]

        # amostras = as mais confiantes (mais típicas da voz)
        order = sorted(idx, key=lambda i: -conf[i])
        samples = [texts[i][:200] for i in order[:4]]

        feats = [features.extract(t) for t in group]
        style = {
            "avg_sentence_len": round(_mean(f.avg_sentence_len for f in feats), 1),
            "slang_rate": round(_mean(f.slang_rate for f in feats), 2),
            "emoji_rate": round(_mean(f.emoji_rate for f in feats), 2),
            "code_score": round(_mean(f.code_score for f in feats), 2),
        }
        out.append({
            "voice_id": vid,
            "size": len(group),
            "confident_size": len(confident),
            "share": round(100 * len(group) / len(texts), 1),
            "top_terms": _top_terms(group),
            "style": style,
            "samples": samples,
        })
    out.sort(key=lambda v: v["size"], reverse=True)
    return out


def _top_terms(texts, n: int = 8) -> list[str]:
    counter: Counter[str] = Counter()
    for t in texts:
        for w in _WORD.findall(t.lower()):
            if w not in _STOP:
                counter[w] += 1
    return [w for w, _ in counter.most_common(n)]


def _mean(xs) -> float:
    xs = list(xs)
    return sum(xs) / len(xs) if xs else 0.0
