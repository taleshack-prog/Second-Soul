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

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

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


# ---------------- consentimento ----------------

class Consent(BaseModel):
    accepted: bool
    version: str = "1.0"


@router.post("/{job_id}/consent")
async def record_consent(job_id: str, body: Consent):
    """Registra o consentimento — quando, para qual versão dos termos.

    A LGPD exige base legal e prova de consentimento; guardar isso junto ao
    acervo torna o registro verificável pela própria pessoa."""
    if not body.accepted:
        raise HTTPException(422, "É preciso aceitar para continuar.")
    d = sessions.session_dir(job_id, create=True)
    (d / "consentimento.json").write_text(
        json.dumps({"accepted": True, "version": body.version,
                    "at": time.time()}, ensure_ascii=False),
        encoding="utf-8",
    )
    return {"recorded": True}


@router.get("/{job_id}/consent")
async def get_consent(job_id: str):
    f = sessions.session_dir(job_id) / "consentimento.json"
    if not f.exists():
        return {"accepted": False}
    return json.loads(f.read_text(encoding="utf-8"))


# ---------------- direito de exclusão ----------------

@router.delete("/{job_id}")
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

@router.get("/{job_id}/export")
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


# ---------------- recuperação de acesso ----------------

@router.get("/admin/list")
async def list_sessions(token: str = ""):
    """Lista as essências existentes — para quem perdeu o link.

    Protegido por token (RECOVERY_TOKEN). Não expõe conteúdo: só o suficiente
    para a pessoa reconhecer a sua (nome, quantidade, datas). Enquanto não há
    contas, esta é a única rede de segurança contra perder o acervo.
    """
    import os

    expected = os.environ.get("RECOVERY_TOKEN", "")
    if not expected or token != expected:
        raise HTTPException(403, "Token inválido.")

    out = []
    root = sessions.SESSIONS_ROOT
    if not root.is_dir():
        return {"sessions": []}

    for d in sorted(root.iterdir(), key=lambda x: -x.stat().st_mtime):
        if not d.is_dir():
            continue
        info = {"job_id": d.name,
                "modificado": time.strftime("%d/%m %H:%M",
                                            time.localtime(d.stat().st_mtime))}
        pf = d / "perfil.json"
        if pf.exists():
            try:
                info["nome"] = json.loads(pf.read_text(encoding="utf-8")).get("name", "")
            except Exception:
                pass
        for fname, key in (("essencia.jsonl", "memorias"),
                           ("acervo_pecas.jsonl", "pecas")):
            f = d / fname
            info[key] = sum(1 for _ in open(f, encoding="utf-8")) if f.exists() else 0
        out.append(info)
    return {"sessions": out}
