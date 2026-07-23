"""Novas memórias — o acervo que cresce ao longo do tempo.

Quatro portas de entrada, um destino:

  texto escrito  -> vai direto para a essência (o gêmeo aprende)
  arquivo .txt/.md -> idem
  áudio/vídeo    -> transcrito (Groq Whisper) -> essência
  imagem         -> guardada como PEÇA DE ACERVO; o que entra na essência é a
                    NARRAÇÃO que a pessoa escreveu sobre ela

Princípio (decidido com o operador): o museu é curadoria, não interpretação.
Nenhuma máquina descreve o quadro, a escultura ou o bonsai — quem fala sobre a
peça é a própria pessoa. A imagem é exibida; a voz é dela.
"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.core import sessions
from app.core.config import settings

router = APIRouter(prefix="/memories", tags=["Memórias"])

_TEXT_EXT = {".txt", ".md", ".markdown", ".rtf"}
_AUDIO_EXT = {".mp3", ".m4a", ".wav", ".ogg", ".opus", ".flac", ".webm"}
_VIDEO_EXT = {".mp4", ".mov", ".mkv", ".avi", ".m4v"}
_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".heic", ".webp", ".gif", ".tiff"}

_WHISPER_MAX_MB = 25  # limite da API de transcrição


def _dir(job_id: str) -> Path:
    d = sessions.session_dir(job_id)
    if not d.is_dir():
        raise HTTPException(404, "Sessão não encontrada. Abra seu acervo pelo link.")
    return d


def _append_essence(job_id: str, content: str, source: str, title: str) -> None:
    """Acrescenta à essência — é o que o gêmeo passa a conhecer."""
    d = _dir(job_id)
    row = {
        "role": "user",
        "content": content,
        "source": source,
        "file_name": title,
        "added_at": time.time(),
    }
    with open(d / "essencia.jsonl", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def _register_piece(job_id: str, piece: dict) -> None:
    """Registra a peça no acervo (o que o museu exibe)."""
    d = _dir(job_id)
    with open(d / "acervo_pecas.jsonl", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(piece, ensure_ascii=False) + "\n")


def _reindex(background: BackgroundTasks, job_id: str) -> None:
    from app.api.v1.endpoints.voices import _build_index
    background.add_task(_build_index, job_id)


# ---------------- memória escrita ----------------

class TextMemory(BaseModel):
    title: str = Field(default="", max_length=200)
    content: str = Field(min_length=10, max_length=100_000)


@router.post("/{job_id}/text")
async def add_text(job_id: str, body: TextMemory, background: BackgroundTasks):
    """Uma crônica, uma história de família, uma decisão que quis registrar."""
    title = body.title.strip() or "Memória escrita"
    _append_essence(job_id, body.content.strip(), "escrita", title)
    _register_piece(job_id, {
        "id": uuid.uuid4().hex[:10], "kind": "texto", "title": title,
        "narration": body.content.strip()[:400], "added_at": time.time(),
    })
    _reindex(background, job_id)
    return {"saved": True, "kind": "texto", "title": title,
            "words": len(body.content.split())}


# ---------------- arquivo (texto, áudio, vídeo, imagem) ----------------

@router.post("/{job_id}/upload")
async def add_file(
    job_id: str,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    narration: str = Form(""),
    title: str = Form(""),
):
    d = _dir(job_id)
    name = file.filename or "arquivo"
    ext = Path(name).suffix.lower()
    display = title.strip() or Path(name).stem

    data = await file.read(60 * 1024 * 1024 + 1)
    if len(data) > 60 * 1024 * 1024:
        raise HTTPException(413, "Arquivo acima de 60 MB.")

    # --- texto ---
    if ext in _TEXT_EXT:
        text = data.decode("utf-8", errors="ignore").strip()
        if len(text) < 10:
            raise HTTPException(422, "Não encontramos texto nesse arquivo.")
        _append_essence(job_id, text, "arquivo", display)
        _register_piece(job_id, {
            "id": uuid.uuid4().hex[:10], "kind": "texto", "title": display,
            "narration": text[:400], "added_at": time.time(),
        })
        _reindex(background, job_id)
        return {"saved": True, "kind": "texto", "title": display,
                "words": len(text.split())}

    # --- áudio e vídeo: transcrição ---
    if ext in _AUDIO_EXT or ext in _VIDEO_EXT:
        mb = len(data) / (1024 * 1024)
        if mb > _WHISPER_MAX_MB:
            raise HTTPException(
                413,
                f"Esse arquivo tem {mb:.0f} MB e o limite para transcrição é "
                f"{_WHISPER_MAX_MB} MB. Grave em trechos menores ou envie só o áudio.",
            )
        if not settings.GROQ_API_KEY:
            raise HTTPException(503, "Transcrição indisponível no momento.")

        text = await _transcribe(data, name)
        if not text.strip():
            raise HTTPException(422, "Não conseguimos ouvir fala nesse arquivo.")

        _append_essence(job_id, text.strip(), "transcricao", display)
        _register_piece(job_id, {
            "id": uuid.uuid4().hex[:10],
            "kind": "audio" if ext in _AUDIO_EXT else "video",
            "title": display, "narration": text.strip()[:400],
            "added_at": time.time(),
        })
        _reindex(background, job_id)
        return {"saved": True, "kind": "transcricao", "title": display,
                "transcript": text.strip()[:600], "words": len(text.split())}

    # --- imagem: peça de museu; a voz é a narração da pessoa ---
    if ext in _IMAGE_EXT:
        pecas = d / "pecas"
        pecas.mkdir(exist_ok=True)
        piece_id = uuid.uuid4().hex[:10]
        stored = pecas / f"{piece_id}{ext}"
        stored.write_bytes(data)

        narr = narration.strip()
        if narr:
            _append_essence(job_id, f"Sobre {display}: {narr}", "peca", display)
            _reindex(background, job_id)
        _register_piece(job_id, {
            "id": piece_id, "kind": "imagem", "title": display,
            "narration": narr, "file": stored.name, "added_at": time.time(),
        })
        return {"saved": True, "kind": "imagem", "title": display,
                "id": piece_id, "narrated": bool(narr)}

    raise HTTPException(
        422,
        f'Ainda não lemos arquivos "{ext}". Aceitamos texto (.txt, .md), '
        "áudio, vídeo e imagens.",
    )


async def _transcribe(data: bytes, filename: str) -> str:
    from groq import AsyncGroq

    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    resp = await client.audio.transcriptions.create(
        file=(filename, data),
        model="whisper-large-v3",
        response_format="json",
    )
    return getattr(resp, "text", "") or ""


# ---------------- listar o acervo ----------------

@router.get("/{job_id}")
async def list_memories(job_id: str):
    d = _dir(job_id)
    f = d / "acervo_pecas.jsonl"
    pieces = []
    if f.exists():
        with open(f, encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    pieces.append(json.loads(line))
    pieces.sort(key=lambda p: p.get("added_at", 0), reverse=True)
    return {"pieces": pieces, "total": len(pieces)}
