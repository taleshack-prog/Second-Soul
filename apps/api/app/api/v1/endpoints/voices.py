"""Separação de vozes no wizard — desenho A+B (validado no dado real).

O app SUGERE os temas dominantes do acervo (automático); o operador MARCA os
que são da pessoa e ajusta o termômetro vendo o que entra/sai (guiado). O
clustering cego errou na conta real; o filtro semeado com humano no loop
acertou — este endpoint implementa exatamente esse fluxo.

  GET  /voices/themes/{job_id}   -> temas sugeridos extraídos do acervo
  POST /voices/preview           -> {job_id, terms, threshold} -> contagem + amostras
  POST /voices/save              -> grava a essência escolhida na sessão
"""

from __future__ import annotations

import json
import re
import tempfile
from collections import Counter
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.core import sessions
from pydantic import BaseModel, Field

router = APIRouter(prefix="/voices", tags=["Separação de vozes"])

_WORD = re.compile(r"[a-zA-ZáàâãéêíóôõúçñÁÀÂÃÉÊÍÓÔÕÚÇÑ]{4,}", re.UNICODE)
_STOP = set(
    "que para com uma como mais mas por sua seu dos das você voce nao não isso "
    "então entao aqui está esta esse essa este muito bem sim tudo pra pro sobre "
    "the and for you that this with have http https www quero fazer pode ainda "
    "também tambem quando onde qual quais json code python print import".split()
)


def _session_dir(job_id: str) -> Path:
    return sessions.session_dir(job_id)


def _load_user_rows(job_id: str) -> list[dict]:
    f = _session_dir(job_id) / "acervo.jsonl"
    if not f.exists():
        raise HTTPException(404, "Sessão não encontrada (importe o acervo primeiro).")
    rows = []
    with open(f, encoding="utf-8") as fh:
        for line in fh:
            obj = json.loads(line)
            if obj.get("role") == "user" and len((obj.get("content") or "").split()) >= 4:
                rows.append(obj)
    return rows


@router.get("/themes/{job_id}")
async def themes(job_id: str, n: int = 24):
    """Temas dominantes do acervo — o 'empurrão' automático das sugestões."""
    rows = _load_user_rows(job_id)
    counter: Counter[str] = Counter()
    for r in rows:
        for w in set(_WORD.findall(r["content"].lower())):
            if w not in _STOP:
                counter[w] += 1
    # termos que aparecem em várias mensagens (não raridades nem onipresentes)
    total = len(rows)
    min_msgs = max(2, total // 40)
    sugestoes = [
        {"term": w, "messages": c}
        for w, c in counter.most_common(200)
        if min_msgs <= c <= max(4, int(total * 0.5))
    ][:n]
    return {"total_user_messages": total, "themes": sugestoes}


class PreviewIn(BaseModel):
    job_id: str
    terms: list[str] = Field(min_length=1)
    threshold: float = 0.03


@router.post("/preview")
async def preview(body: PreviewIn):
    """Termômetro ao vivo: com estes termos e este corte, o que entra?"""
    rows = _load_user_rows(body.job_id)
    kept_idx, scores = _score(rows, body.terms, body.threshold)

    grid = {}
    for t in (0.02, 0.03, 0.05, 0.08, 0.12):
        grid[t] = int(sum(1 for s in scores if s >= t))

    samples = [rows[i]["content"][:220] for i in kept_idx[:5]]
    border = [
        f"({scores[i]:.2f}) {rows[i]['content'][:140]}"
        for i in sorted(range(len(rows)), key=lambda i: -scores[i])
        if i not in set(kept_idx)
    ][:4]

    return {
        "total": len(rows),
        "kept": len(kept_idx),
        "threshold": body.threshold,
        "grid": grid,
        "samples": samples,
        "borderline": border,
    }


class SaveIn(PreviewIn):
    person_name: str = "a pessoa"


@router.post("/save")
async def save(body: SaveIn, background: BackgroundTasks):
    """Grava a essência escolhida e já dispara a indexação do gêmeo.

    Decisão de produto: o índice (SBERT) é construído AQUI, em segundo plano,
    para que a conversa — o momento emocional — abra sem fricção depois."""
    rows = _load_user_rows(body.job_id)
    kept_idx, _ = _score(rows, body.terms, body.threshold)
    kept = [rows[i] for i in kept_idx]
    if not kept:
        raise HTTPException(422, "Nenhuma fala passou no corte — baixe o termômetro.")

    d = _session_dir(body.job_id)
    with open(d / "essencia.jsonl", "w", encoding="utf-8") as fh:
        for r in kept:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    (d / "pessoa.json").write_text(
        json.dumps({"name": body.person_name, "terms": body.terms,
                    "threshold": body.threshold, "kept": len(kept)},
                   ensure_ascii=False),
        encoding="utf-8",
    )
    background.add_task(_build_index, body.job_id)
    return {"saved": len(kept), "person": body.person_name}


def _build_index(job_id: str) -> None:
    """Constrói (ou reconstrói) o índice do gêmeo da sessão: essência + perfil.

    Chamado no save da essência e re-chamado no save do perfil, para a
    verdade declarada entrar com peso assim que existir."""
    d = _session_dir(job_id)
    marker = d / "index_status.json"
    try:
        marker.write_text('{"status":"building"}', encoding="utf-8")
        from second_soul_twin import TwinIndex, profile as prof

        rows = []
        with open(d / "essencia.jsonl", encoding="utf-8") as fh:
            for line in fh:
                obj = json.loads(line)
                if len((obj.get("content") or "").split()) >= 3:
                    rows.append(obj)

        summary = {}
        pfile = d / "perfil.json"
        if pfile.exists():
            p = json.loads(pfile.read_text(encoding="utf-8"))
            rows = prof.profile_to_items(p) + rows
            summary = prof.summaries(p)

        # SBERT é o backend do gêmeo (recupera por significado). Se o pacote
        # não estiver disponível, degrada pra TF-IDF com aviso — melhor um
        # gêmeo funcional mais fraco do que nenhum.
        backend = "sbert"
        try:
            import sentence_transformers  # noqa: F401
        except ModuleNotFoundError:
            backend = "tfidf"

        idx = TwinIndex(backend=backend).build(rows, profile=summary)
        idx.save(d / "twin_index")
        marker.write_text(json.dumps({"status": "ready", "backend": backend}),
                          encoding="utf-8")
    except Exception as exc:
        marker.write_text(json.dumps({"status": "error", "detail": str(exc)}),
                          encoding="utf-8")


def _score(rows: list[dict], terms: list[str], threshold: float):
    """TF-IDF por consulta — o mesmo mecanismo validado no terminal."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    texts = [r["content"] for r in rows]
    vec = TfidfVectorizer(max_features=8000, ngram_range=(1, 2), sublinear_tf=True)
    X = vec.fit_transform(texts)
    q = vec.transform([" ".join(terms)])
    scores = cosine_similarity(q, X)[0]
    order = sorted(range(len(rows)), key=lambda i: -scores[i])
    kept = [i for i in order if scores[i] >= threshold]
    return kept, scores
