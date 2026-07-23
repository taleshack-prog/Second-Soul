"""Armazenamento das sessões — em disco PERSISTENTE.

Antes: /tmp (efêmero). Todo redeploy do container apagava a essência que a
pessoa levou horas curando. Agora: um diretório configurável (SESSIONS_DIR),
apontado para um volume que sobrevive a reinícios e deploys.

Local (dev):     ./.secondsoul_data/sessions
Railway (prod):  /data/sessions  (volume montado em /data)
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

_DEFAULT = str(Path.cwd() / ".secondsoul_data" / "sessions")
SESSIONS_ROOT = Path(os.environ.get("SESSIONS_DIR", _DEFAULT))


def session_dir(job_id: str, create: bool = False) -> Path:
    d = SESSIONS_ROOT / job_id
    if create:
        d.mkdir(parents=True, exist_ok=True)
    return d


def exists(job_id: str) -> bool:
    return (SESSIONS_ROOT / job_id).is_dir()


def state(job_id: str) -> dict[str, Any]:
    """Onde a pessoa parou — permite retomar pelo link de retorno."""
    d = session_dir(job_id)
    if not d.is_dir():
        return {"found": False}

    has_acervo = (d / "acervo.jsonl").exists()
    has_essencia = (d / "essencia.jsonl").exists()
    has_perfil = (d / "perfil.json").exists()
    has_index = (d / "twin_index" / "meta.json").exists()

    person: dict[str, Any] = {}
    if (d / "pessoa.json").exists():
        try:
            person = json.loads((d / "pessoa.json").read_text(encoding="utf-8"))
        except Exception:
            person = {}

    # em que passo do wizard retomar
    if has_index or has_essencia:
        step = 6 if has_index else 5
    elif has_acervo:
        step = 4
    else:
        step = 2

    return {
        "found": True,
        "job_id": job_id,
        "step": step,
        "has_acervo": has_acervo,
        "has_essencia": has_essencia,
        "has_perfil": has_perfil,
        "twin_ready": has_index,
        "person_name": person.get("name", ""),
        "memories": person.get("kept", 0),
    }


def counts(job_id: str) -> dict[str, int]:
    """Quantas linhas em cada arquivo (para a tela de retomada)."""
    d = session_dir(job_id)
    out = {}
    for name, key in (("acervo.jsonl", "acervo"), ("essencia.jsonl", "essencia")):
        f = d / name
        out[key] = sum(1 for _ in open(f, encoding="utf-8")) if f.exists() else 0
    return out
