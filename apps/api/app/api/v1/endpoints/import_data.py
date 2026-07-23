"""Importação assíncrona — o upload responde na hora; o pipeline roda atrás.

Motivo (medido no dado real): um export do ChatGPT com 5.379 mensagens trava o
navegador por minutos se processado de forma síncrona. Aqui:
  POST /import/upload  -> grava o arquivo, cria a tarefa, devolve {job_id}
  GET  /import/status/{job_id} -> etapa atual (real) e, ao fim, o resultado
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.schemas.import_data import ImportPreviewItem, ImportResult, JobAccepted, JobStatus
from app.services.jobs import STAGES, store
from app.core import sessions

router = APIRouter(prefix="/import", tags=["Importação"])

_ALLOWED_SUFFIXES = {".zip", ".json"}
_PII_LEVELS = {"strict", "balanced", "minimal"}


@router.get("/stages")
async def stages():
    """Etapas canônicas — a UI usa para desenhar o progresso."""
    return {"stages": STAGES}


@router.post("/upload", response_model=JobAccepted, status_code=202)
async def upload(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    pii_level: str = Form("strict"),
):
    if pii_level not in _PII_LEVELS:
        raise HTTPException(422, f"pii_level inválido. Use: {sorted(_PII_LEVELS)}")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _ALLOWED_SUFFIXES:
        raise HTTPException(
            422,
            "Formato não suportado nesta etapa. Envie o .zip do export do ChatGPT "
            "ou o conversations.json.",
        )

    max_bytes = settings.MAX_CONTENT_SIZE_MB * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"Arquivo acima de {settings.MAX_CONTENT_SIZE_MB} MB.")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.close()

    original = file.filename or Path(tmp.name).name
    job_id = store.create(original)
    background.add_task(_process, job_id, tmp.name, pii_level, original)
    return JobAccepted(job_id=job_id, file=original)


@router.get("/status/{job_id}", response_model=JobStatus)
async def status(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Tarefa não encontrada (pode ter expirado).")
    return JobStatus(**job)


def _process(job_id: str, tmp_path: str, pii_level: str, original: str) -> None:
    """Roda o pipeline em segundo plano, reportando cada etapa real."""
    try:
        from second_soul_importer import ImportPipeline
    except ModuleNotFoundError:
        store.fail(job_id, "Pacote de importação não instalado "
                           "(pip install -e packages/importer).")
        Path(tmp_path).unlink(missing_ok=True)
        return

    try:
        pipe = ImportPipeline(user_id="onboarding", pii_level=pii_level)
        res = pipe.run_staged(
            tmp_path,
            on_stage=lambda stage, info: store.set_stage(job_id, stage, info),
        )
        items = res.pop("items")
        _save_session(job_id, items)
        preview = [
            ImportPreviewItem(
                role=i.role, source=i.source, content=i.content[:400],
                pii_scrubbed=i.pii_scrubbed, classification=i.classification,
            ).model_dump()
            for i in items[:6]
        ]
        store.finish(job_id, ImportResult(
            status=res["status"], platform=res["platform"], file=original,
            raw_count=res["raw_count"], clean_count=res["clean_count"],
            scrubbed_count=res["scrubbed_count"], by_role=res["by_role"],
            preview=preview,
        ).model_dump())
    except ValueError:
        store.fail(job_id, _diagnose(tmp_path, original))
    except Exception as exc:  # falha inesperada: reporta sem derrubar a API
        store.fail(job_id, f"Falha ao processar: {exc}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _diagnose(tmp_path: str, original: str) -> str:
    """Erro útil: diz o que REALMENTE veio no arquivo, em vez de só recusar.

    Motivado por um caso real: com dezenas de .zip na pasta, é fácil enviar o
    arquivo errado — e 'não reconhecemos' não ajuda a descobrir isso.
    """
    import zipfile

    p = Path(tmp_path)
    try:
        if p.suffix.lower() == ".zip":
            with zipfile.ZipFile(p) as zf:
                names = [n for n in zf.namelist() if not n.endswith("/")]
            amostra = ", ".join(Path(n).name for n in names[:4]) or "nenhum arquivo"
            return (
                f'"{original}" não parece ser o export do ChatGPT: são '
                f"{len(names)} arquivo(s) dentro ({amostra}"
                f"{'…' if len(names) > 4 else ''}) e nenhum é conversations.json. "
                "O export do ChatGPT vem com conversations.json (ou "
                "conversations-000.json, -001.json…) dentro."
            )
        return (
            f'"{original}" é um .json, mas não tem a estrutura do export do '
            "ChatGPT (uma lista de conversas com 'mapping'). Envie o "
            "conversations.json que vem dentro do .zip do export."
        )
    except Exception:
        return (
            f'Não conseguimos ler "{original}". Envie o .zip original do export '
            "do ChatGPT ou o conversations.json de dentro dele."
        )


def _save_session(job_id: str, items) -> None:
    """Guarda o acervo completo da sessão em disco para as próximas etapas
    (separar vozes, perfil). TTL segue o do job store."""
    import json as _json

    d = sessions.session_dir(job_id, create=True)
    with open(d / "acervo.jsonl", "w", encoding="utf-8") as fh:
        for it in items:
            fh.write(_json.dumps(it.to_dict(), ensure_ascii=False) + "\n")
