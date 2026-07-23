"""Retomar uma essência pelo link.

A pessoa guarda o link (/s/{job_id}) e volta quando quiser — em outro dia, em
outro aparelho. Este endpoint diz em que passo ela parou, para o wizard abrir
no lugar certo em vez de começar do zero.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException

from app.core import sessions

router = APIRouter(prefix="/session", tags=["Sessão"])


@router.post("/new")
async def new_session():
    """Cria uma essência vazia — a jornada começa por QUEM a pessoa é,
    não por um arquivo. Importar conversas passa a ser uma opção do acervo."""
    job_id = uuid.uuid4().hex[:12]
    sessions.session_dir(job_id, create=True)
    return {"job_id": job_id}


@router.get("/{job_id}")
async def get_session(job_id: str):
    st = sessions.state(job_id)
    if not st.get("found"):
        raise HTTPException(
            404,
            "Não encontramos essa essência. Confira se o link está completo — "
            "ele é a única chave para voltar a este acervo.",
        )
    st.update(sessions.counts(job_id))
    return st
