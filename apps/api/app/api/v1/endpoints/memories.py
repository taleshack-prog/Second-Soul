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
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.core import sessions
from app.core.config import settings

router = APIRouter(prefix="/memories", tags=["Memórias"])

_TEXT_EXT = {".txt", ".md", ".markdown", ".rtf", ".csv"}
_DOC_EXT = {".docx", ".pdf", ".odt", ".doc"}
_AUDIO_EXT = {".mp3", ".m4a", ".wav", ".ogg", ".opus", ".flac", ".webm"}
_VIDEO_EXT = {".mp4", ".mov", ".mkv", ".avi", ".m4v"}
_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".heic", ".webp", ".gif", ".tiff"}

_WHISPER_MAX_MB = 25  # limite da API de transcrição


def _dir(job_id: str) -> Path:
    d = sessions.session_dir(job_id)
    if not d.is_dir():
        raise HTTPException(404, "Sessão não encontrada. Abra seu acervo pelo link.")
    return d


def _append_essence(job_id: str, content: str, source: str, title: str,
                    piece_id: str = "") -> None:
    """Acrescenta à essência — é o que o gêmeo passa a conhecer.

    piece_id liga esta linha à peça correspondente no acervo, para permitir
    editar e excluir depois (linhas antigas não têm e são casadas por heurística).
    """
    d = _dir(job_id)
    row = {
        "role": "user",
        "content": content,
        "source": source,
        "file_name": title,
        "piece_id": piece_id,
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


# ---------------- leitura/escrita dos registros (editar e excluir) ----------------

def _read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    if path.exists():
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    rows.append(json.loads(line))
    return rows


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    """Reescreve o arquivo inteiro de forma atômica (temp + replace).

    Os .jsonl eram só-acrescentar; editar/excluir exige reescrever. O temp no
    mesmo diretório + os.replace evita deixar o arquivo corrompido se algo
    falhar no meio."""
    import os
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    os.replace(tmp, path)


def _match_essence_idx(ess_rows: list[dict], piece: dict) -> int | None:
    """Acha a linha da essência que corresponde a uma peça.

    Primeiro pelo piece_id (linhas novas). Para linhas antigas (sem piece_id),
    casa por título + início do conteúdo — na criação a narração da peça é o
    conteúdo truncado em 400, então o conteúdo da essência começa pela narração.
    Devolve o índice ou None.
    """
    pid = piece.get("id", "")
    for i, r in enumerate(ess_rows):
        if pid and r.get("piece_id") == pid:
            return i
    # heurística para linhas antigas sem piece_id
    title = (piece.get("title") or "").strip()
    narr = (piece.get("narration") or "").strip()
    for i, r in enumerate(ess_rows):
        if r.get("piece_id"):
            continue  # já ligada a outra peça
        if (r.get("file_name") or "").strip() != title:
            continue
        content = (r.get("content") or "").strip()
        if narr and (content[:400].strip() == narr or narr in content):
            return i
    return None


# ---------------- memória escrita ----------------

class TextMemory(BaseModel):
    title: str = Field(default="", max_length=200)
    content: str = Field(min_length=10, max_length=100_000)


@router.post("/{job_id}/text")
async def add_text(job_id: str, body: TextMemory, background: BackgroundTasks):
    """Uma crônica, uma história de família, uma decisão que quis registrar."""
    title = body.title.strip() or "Memória escrita"
    content = body.content.strip()
    piece_id = uuid.uuid4().hex[:10]
    _append_essence(job_id, content, "escrita", title, piece_id)
    _register_piece(job_id, {
        "id": piece_id, "kind": "texto", "title": title,
        "narration": content[:400], "added_at": time.time(),
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

    # --- texto e documentos (docx, pdf, odt) ---
    if ext in _TEXT_EXT or ext in _DOC_EXT:
        text = (_extract_document(data, ext) if ext in _DOC_EXT
                else data.decode("utf-8", errors="ignore")).strip()
        if len(text) < 10:
            raise HTTPException(422, "Não encontramos texto nesse arquivo.")
        piece_id = uuid.uuid4().hex[:10]
        _append_essence(job_id, text, "arquivo", display, piece_id)
        _register_piece(job_id, {
            "id": piece_id, "kind": "texto", "title": display,
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

        piece_id = uuid.uuid4().hex[:10]
        _append_essence(job_id, text.strip(), "transcricao", display, piece_id)
        _register_piece(job_id, {
            "id": piece_id,
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
            _append_essence(job_id, f"Sobre {display}: {narr}", "peca", display, piece_id)
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


def _extract_document(data: bytes, ext: str) -> str:
    """Extrai o texto de documentos — é neles que moram crônicas e ensaios."""
    import io

    if ext == ".docx":
        try:
            import docx
        except ModuleNotFoundError:
            raise HTTPException(503, "Leitura de .docx indisponível no momento.")
        doc = docx.Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    if ext == ".pdf":
        try:
            from pypdf import PdfReader
        except ModuleNotFoundError:
            raise HTTPException(503, "Leitura de PDF indisponível no momento.")
        reader = PdfReader(io.BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages)

    if ext == ".odt":
        import xml.etree.ElementTree as ET
        import zipfile
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            xml = z.read("content.xml")
        root = ET.fromstring(xml)
        return "\n".join(t.strip() for t in root.itertext() if t.strip())

    raise HTTPException(
        422,
        'Arquivos ".doc" (Word antigo) não são lidos. Salve como .docx ou PDF.',
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

@router.get("/{job_id}/piece/{piece_id}")
async def get_piece_file(job_id: str, piece_id: str):
    """Serve a imagem de uma peça — é o que o álbum exibe."""
    d = _dir(job_id)
    pecas = d / "pecas"
    if not pecas.is_dir():
        raise HTTPException(404, "Peça não encontrada.")
    for f in pecas.iterdir():
        if f.stem == piece_id:
            return FileResponse(f)
    raise HTTPException(404, "Peça não encontrada.")


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


# ---------------- revisar, editar e excluir uma memória ----------------

def _find_piece(d: Path, piece_id: str) -> tuple[list[dict], int]:
    """Carrega as peças e devolve (peças, índice da peça). 404 se não achar."""
    pieces = _read_jsonl(d / "acervo_pecas.jsonl")
    for i, p in enumerate(pieces):
        if p.get("id") == piece_id:
            return pieces, i
    raise HTTPException(404, "Memória não encontrada.")


@router.get("/{job_id}/item/{piece_id}")
async def get_item(job_id: str, piece_id: str):
    """Devolve a memória completa para revisão — o texto inteiro, não o resumo."""
    d = _dir(job_id)
    pieces, idx = _find_piece(d, piece_id)
    piece = pieces[idx]
    ess = _read_jsonl(d / "essencia.jsonl")
    ei = _match_essence_idx(ess, piece)

    full = piece.get("narration", "")
    if ei is not None:
        content = ess[ei].get("content", "")
        # para imagens o conteúdo da essência é "Sobre {título}: {narração}";
        # devolvemos só a narração para edição
        if piece.get("kind") == "imagem":
            prefix = f"Sobre {piece.get('title','')}: "
            full = content[len(prefix):] if content.startswith(prefix) else content
        else:
            full = content
    return {
        "id": piece["id"],
        "kind": piece.get("kind", "texto"),
        "title": piece.get("title", ""),
        "content": full,
        "has_image": bool(piece.get("file")),
    }


class EditItem(BaseModel):
    title: str = Field(default="", max_length=200)
    content: str | None = Field(default=None, max_length=100_000)


@router.patch("/{job_id}/item/{piece_id}")
async def edit_item(job_id: str, piece_id: str, body: EditItem,
                    background: BackgroundTasks):
    """Corrige o título e/ou o texto de uma memória, nos dois lados (acervo +
    essência), e manda o gêmeo reaprender."""
    d = _dir(job_id)
    pieces, idx = _find_piece(d, piece_id)
    piece = pieces[idx]
    kind = piece.get("kind", "texto")

    new_title = body.title.strip() or piece.get("title", "") or "Memória"
    # conteúdo: se não veio, mantém o atual (só mudou o título)
    keep_content = body.content is None
    new_content = (body.content or "").strip()

    ess = _read_jsonl(d / "essencia.jsonl")
    ei = _match_essence_idx(ess, piece)
    if keep_content:
        if ei is not None:
            cur = ess[ei].get("content", "")
            if kind == "imagem":
                prefix = f"Sobre {piece.get('title','')}: "
                new_content = cur[len(prefix):] if cur.startswith(prefix) else cur
            else:
                new_content = cur
        else:
            new_content = piece.get("narration", "")

    # --- atualiza a peça (o que o álbum mostra) ---
    piece["title"] = new_title
    piece["narration"] = new_content if kind == "imagem" else new_content[:400]
    pieces[idx] = piece
    _write_jsonl(d / "acervo_pecas.jsonl", pieces)

    # --- atualiza a linha da essência (o que o gêmeo sabe) ---
    if kind == "imagem":
        ess_content = f"Sobre {new_title}: {new_content}" if new_content else ""
    else:
        ess_content = new_content

    if ei is not None:
        if ess_content:
            ess[ei]["content"] = ess_content
            ess[ei]["file_name"] = new_title
            ess[ei]["piece_id"] = piece_id
        else:  # imagem ficou sem narração: a essência não tem o que aprender
            ess.pop(ei)
        _write_jsonl(d / "essencia.jsonl", ess)
    elif ess_content:
        # não havia linha (ex.: imagem antes sem narração): cria uma
        _append_essence(job_id, ess_content,
                        "peca" if kind == "imagem" else "escrita",
                        new_title, piece_id)

    _reindex(background, job_id)
    return {"saved": True, "id": piece_id, "title": new_title}


@router.delete("/{job_id}/item/{piece_id}")
async def delete_item(job_id: str, piece_id: str, background: BackgroundTasks):
    """Remove uma memória por inteiro: a peça, a linha da essência e, se for
    imagem, o arquivo. O gêmeo deixa de conhecê-la."""
    d = _dir(job_id)
    pieces, idx = _find_piece(d, piece_id)
    piece = pieces.pop(idx)
    _write_jsonl(d / "acervo_pecas.jsonl", pieces)

    ess = _read_jsonl(d / "essencia.jsonl")
    ei = _match_essence_idx(ess, piece)
    if ei is not None:
        ess.pop(ei)
        _write_jsonl(d / "essencia.jsonl", ess)

    # apaga o arquivo da imagem, se houver
    if piece.get("file"):
        img = d / "pecas" / piece["file"]
        try:
            if img.exists():
                img.unlink()
        except OSError:
            pass

    _reindex(background, job_id)
    return {"deleted": True, "id": piece_id}
