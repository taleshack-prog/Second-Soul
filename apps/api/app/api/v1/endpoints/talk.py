"""Conversa com a essência — o capítulo final do wizard.

  GET  /twin/ready/{job_id}  -> o índice da sessão está pronto?
  POST /twin/talk            -> {job_id, message} -> resposta na voz dela

O índice foi construído no "Guardar a essência" (e refeito ao salvar o perfil),
então a conversa abre sem fricção. A credencial e o tom declarados no perfil
viajam com a voz em toda resposta.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core import sessions

router = APIRouter(prefix="/twin", tags=["Gêmeo Digital"])

_INDEX_CACHE: dict[str, object] = {}


def _session_dir(job_id: str) -> Path:
    return sessions.session_dir(job_id)


@router.get("/ready/{job_id}")
async def ready(job_id: str):
    d = _session_dir(job_id)
    marker = d / "index_status.json"
    if not marker.exists():
        return {"status": "missing"}
    st = json.loads(marker.read_text(encoding="utf-8"))
    person = {}
    pf = d / "pessoa.json"
    if pf.exists():
        person = json.loads(pf.read_text(encoding="utf-8"))
    return {**st, "person": person.get("name", ""), "memories": person.get("kept", 0)}


class TalkIn(BaseModel):
    job_id: str
    message: str = Field(min_length=1, max_length=2000)


@router.post("/talk")
async def talk(body: TalkIn):
    d = _session_dir(body.job_id)
    idx_dir = d / "twin_index"
    if not (idx_dir / "meta.json").exists():
        raise HTTPException(409, "A essência ainda está sendo preparada. "
                                 "Aguarde alguns instantes e tente de novo.")

    idx = _INDEX_CACHE.get(body.job_id)
    if idx is None:
        from second_soul_twin import TwinIndex
        idx = TwinIndex.load(idx_dir)
        _INDEX_CACHE[body.job_id] = idx

    person = json.loads((d / "pessoa.json").read_text(encoding="utf-8"))
    name = person.get("name") or "a pessoa"

    hits = idx.query(body.message, k=6)

    if not settings.GROQ_API_KEY:
        return {
            "message": f"[modo eco — defina GROQ_API_KEY no .env] Como {name}, "
                       f"sobre '{body.message}'… (recuperei {len(hits)} memórias)",
            "grounded_on": len(hits),
            "model": "echo",
        }

    from second_soul_twin.generate import build_messages
    from groq import AsyncGroq

    p = idx.profile or {}
    messages = build_messages(body.message, hits, name,
                              credential=p.get("credential", ""),
                              style=p.get("style", ""))
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    resp = await client.chat.completions.create(
        model=settings.GROQ_MODEL, messages=messages,
        temperature=0.7, max_tokens=1024,
    )
    return {
        "message": resp.choices[0].message.content or "",
        "grounded_on": len(hits),
        "model": settings.GROQ_MODEL,
    }
