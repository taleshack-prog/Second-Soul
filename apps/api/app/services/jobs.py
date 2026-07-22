"""Fila de tarefas em memória para importações em segundo plano.

MVP: um dicionário protegido por lock, sem Redis/Celery. Isso mantém o dev
local trivial (nada pra subir) e é suficiente para um processo. Quando houver
múltiplos workers/instâncias, trocar por Celery+Redis — a interface (create,
set_stage, finish, get) permanece a mesma.

Etapas REAIS (nada de porcentagem inventada): cada uma acende quando ocorre.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any

# ordem canônica das etapas, usada pela UI para desenhar o progresso
STAGES: list[dict[str, str]] = [
    {"key": "detectando", "label": "Reconhecendo o arquivo"},
    {"key": "lendo", "label": "Lendo as conversas"},
    {"key": "limpando", "label": "Removendo ruído"},
    {"key": "deduplicando", "label": "Removendo repetições"},
    {"key": "protegendo", "label": "Protegendo dados sensíveis"},
    {"key": "concluido", "label": "Pronto"},
]

_TTL_SECONDS = 3600  # tarefas terminadas somem depois de 1h


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create(self, file_name: str) -> str:
        job_id = uuid.uuid4().hex[:12]
        with self._lock:
            self._jobs[job_id] = {
                "id": job_id,
                "status": "queued",       # queued | running | done | error
                "stage": None,
                "stage_info": {},
                "file": file_name,
                "result": None,
                "error": None,
                "created_at": time.time(),
                "updated_at": time.time(),
            }
        return job_id

    def set_stage(self, job_id: str, stage: str, info: dict[str, Any]) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job["status"] = "running"
            job["stage"] = stage
            job["stage_info"] = info
            job["updated_at"] = time.time()

    def finish(self, job_id: str, result: dict[str, Any]) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.update(status="done", stage="concluido", result=result,
                       updated_at=time.time())

    def fail(self, job_id: str, message: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.update(status="error", error=message, updated_at=time.time())

    def get(self, job_id: str) -> dict[str, Any] | None:
        self._sweep()
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

    def _sweep(self) -> None:
        now = time.time()
        with self._lock:
            expired = [
                k for k, j in self._jobs.items()
                if j["status"] in ("done", "error") and now - j["updated_at"] > _TTL_SECONDS
            ]
            for k in expired:
                self._jobs.pop(k, None)


store = JobStore()
