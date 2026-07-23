"""Perfil da pessoa — o formulário da Florença como produto.

O protótipo: um JSON preenchido à mão pela primeira usuária (a mãe do Tales),
que ela reconheceu como fiel. Aqui ele vira tela para todos: campos sugeridos
como convite, todos opcionais, texto livre. A verdade declarada pesa mais que
a inferida no gêmeo (ver twin-engine/profile.py).

  GET  /profile/fields          -> os campos sugeridos (labels + convites)
  POST /profile/{job_id}        -> salva o perfil preenchido na sessão
  GET  /profile/{job_id}        -> recupera (para editar depois)
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.core import sessions
from pydantic import BaseModel

router = APIRouter(prefix="/profile", tags=["Perfil"])

# Fonte única: os mesmos campos do pacote twin-engine
try:
    from second_soul_twin.profile import FIELDS
except ModuleNotFoundError:  # API sobe mesmo sem o pacote em dev
    FIELDS = []


def _session_dir(job_id: str) -> Path:
    return sessions.session_dir(job_id)


@router.get("/fields")
async def fields():
    return {"fields": FIELDS}


class ProfileIn(BaseModel):
    name: str = ""
    fields: dict[str, str] = {}


@router.post("/{job_id}")
async def save_profile(job_id: str, body: ProfileIn, background: BackgroundTasks):
    d = _session_dir(job_id)
    if not d.exists():
        raise HTTPException(404, "Sessão não encontrada (importe o acervo primeiro).")
    filled = sum(1 for v in body.fields.values() if (v or "").strip())
    (d / "perfil.json").write_text(
        json.dumps({"name": body.name, "fields": body.fields}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    # reindexa o gêmeo com a verdade declarada (se a essência já existe)
    if (d / "essencia.jsonl").exists():
        from app.api.v1.endpoints.voices import _build_index
        background.add_task(_build_index, job_id)
    return {"saved": True, "filled_fields": filled}


@router.get("/{job_id}")
async def get_profile(job_id: str):
    f = _session_dir(job_id) / "perfil.json"
    if not f.exists():
        raise HTTPException(404, "Perfil ainda não preenchido nesta sessão.")
    return json.loads(f.read_text(encoding="utf-8"))
