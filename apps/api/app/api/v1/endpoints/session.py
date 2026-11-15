"""Retomar uma essência pelo link.

A pessoa guarda o link (/s/{job_id}) e volta quando quiser — em outro dia, em
outro aparelho. Este endpoint diz em que passo ela parou, para o wizard abrir
no lugar certo em vez de começar do zero.
"""

from __future__ import annotations

import io
import json
import shutil
import time
import uuid
import zipfile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import archive_owner, current_account
from app.core import sessions
from app.core.database import get_db
from app.models.account import Account, ArchiveLink, LinkStatus, Role

router = APIRouter(prefix="/session", tags=["Sessão"])


@router.post("/new")
async def new_session(
    acc: Account = Depends(current_account),
    db: AsyncSession = Depends(get_db),
):
    """Cria uma essência vazia — a jornada começa por QUEM a pessoa é,
    não por um arquivo. Importar conversas passa a ser uma opção do acervo.

    Exige login: a essência nasce com a conta logada como DONA (owner/ativo).
    O caminho do admin (vincular a essência de outra pessoa a herdeiros)
    continua existindo em paralelo, no painel."""
    job_id = uuid.uuid4().hex[:12]
    sessions.session_dir(job_id, create=True)

    db.add(ArchiveLink(
        account_id=acc.id, job_id=job_id,
        role=Role.owner, status=LinkStatus.active,
    ))
    await db.commit()

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


# ---------------- e-mail de recuperação ----------------

class RecoveryEmail(BaseModel):
    email: str


@router.post("/{job_id}/email", dependencies=[Depends(archive_owner)])
async def set_recovery_email(job_id: str, body: RecoveryEmail):
    """Guarda um e-mail junto ao acervo — a rede de segurança contra perder o
    link. Não enviamos nada: serve para reencontrar o acervo se a pessoa pedir.
    """
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(422, "E-mail inválido.")
    d = sessions.session_dir(job_id, create=True)
    (d / "contato.json").write_text(
        json.dumps({"email": email, "at": time.time()}, ensure_ascii=False),
        encoding="utf-8",
    )
    return {"saved": True}


@router.get("/{job_id}/email", dependencies=[Depends(archive_owner)])
async def get_recovery_email(job_id: str):
    f = sessions.session_dir(job_id) / "contato.json"
    if not f.exists():
        return {"email": ""}
    return {"email": json.loads(f.read_text(encoding="utf-8")).get("email", "")}


# ---------------- consentimento ----------------

class Consent(BaseModel):
    # consentimentos granulares (LGPD): cada um é uma base legal própria.
    sensitive: bool = False       # art. 11 — dados sensíveis (saúde, crença, etc.)
    international: bool = False    # art. 33 — transferência internacional (EUA)
    ai: bool = False              # processamento por provedor de IA (Groq)
    version: str = "2.0"
    # compatibilidade com a versão antiga (aceite único)
    accepted: bool = False


@router.post("/{job_id}/consent", dependencies=[Depends(archive_owner)])
async def record_consent(job_id: str, body: Consent):
    """Registra o consentimento — quando, para qual versão dos termos.

    A LGPD exige base legal e prova de consentimento; guardar isso junto ao
    acervo torna o registro verificável pela própria pessoa."""
    # cada consentimento granular é obrigatório — a LGPD exige consentimento
    # específico e destacado, não um aceite único em bloco.
    if not (body.sensitive and body.international and body.ai):
        raise HTTPException(
            422, "É preciso consentir com os três itens para continuar."
        )
    d = sessions.session_dir(job_id, create=True)
    (d / "consentimento.json").write_text(
        json.dumps({
            "sensitive": body.sensitive,
            "international": body.international,
            "ai": body.ai,
            "accepted": True,  # os três marcados
            "version": body.version,
            "at": time.time(),
        }, ensure_ascii=False),
        encoding="utf-8",
    )
    return {"recorded": True}


@router.get("/{job_id}/consent", dependencies=[Depends(archive_owner)])
async def get_consent(job_id: str):
    f = sessions.session_dir(job_id) / "consentimento.json"
    if not f.exists():
        return {"accepted": False}
    return json.loads(f.read_text(encoding="utf-8"))


# ---------------- direito de exclusão ----------------

@router.delete("/{job_id}", dependencies=[Depends(archive_owner)])
async def delete_session(job_id: str, confirm: str = ""):
    """Apaga tudo, sem resto. Exige confirmação explícita."""
    if confirm != "APAGAR":
        raise HTTPException(
            422, 'Para apagar, envie confirm="APAGAR". Isto não tem volta.'
        )
    d = sessions.session_dir(job_id)
    if not d.is_dir():
        raise HTTPException(404, "Essência não encontrada.")
    shutil.rmtree(d, ignore_errors=True)
    return {"deleted": True, "job_id": job_id}


# ---------------- direito de portabilidade ----------------

@router.get("/{job_id}/export", dependencies=[Depends(archive_owner)])
async def export_session(job_id: str):
    """Leva embora: tudo o que guardamos, num único arquivo."""
    d = sessions.session_dir(job_id)
    if not d.is_dir():
        raise HTTPException(404, "Essência não encontrada.")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for f in d.rglob("*"):
            # o índice vetorial é derivado; não é dado da pessoa
            if f.is_file() and "twin_index" not in f.parts:
                z.write(f, f.relative_to(d).as_posix())
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition":
                 f'attachment; filename="second-soul-{job_id}.zip"'},
    )
