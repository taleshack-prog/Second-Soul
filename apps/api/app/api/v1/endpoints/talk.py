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

# cache do índice por sessão: (mtime do meta.json, índice)
# o mtime evita servir um índice velho depois que o perfil foi salvo
# e o gêmeo foi reindexado — bug real: o perfil não fazia efeito.
_INDEX_CACHE: dict[str, tuple[float, object]] = {}


def _session_dir(job_id: str) -> Path:
    return sessions.session_dir(job_id)


@router.get("/ready/{job_id}")
async def ready(job_id: str):
    d = _session_dir(job_id)
    marker = d / "index_status.json"
    if not marker.exists():
        return {"status": "missing"}
    st = json.loads(marker.read_text(encoding="utf-8"))
    person, memories = "", 0
    pf = d / "pessoa.json"
    if pf.exists():
        blob = json.loads(pf.read_text(encoding="utf-8"))
        person, memories = blob.get("name", ""), blob.get("kept", 0)
    prof = d / "perfil.json"
    if not person and prof.exists():
        person = json.loads(prof.read_text(encoding="utf-8")).get("name", "")
    if not memories:
        ess = d / "essencia.jsonl"
        memories = sum(1 for _ in open(ess, encoding="utf-8")) if ess.exists() else 0

    # Se o índice foi construído em TF-IDF mas o SBERT agora está disponível,
    # ele está defasado (lê por letra, não por sentido). Reconstrói uma vez,
    # em segundo plano, para o gêmeo recuperar por significado sem que a pessoa
    # precise refazer nada.
    if st.get("backend") == "tfidf":
        try:
            import sentence_transformers  # noqa: F401
            from app.api.v1.endpoints.voices import _build_index
            import asyncio
            marker.write_text(json.dumps({"status": "building"}), encoding="utf-8")
            asyncio.get_event_loop().run_in_executor(None, _build_index, job_id)
            _INDEX_CACHE.pop(job_id, None)
            return {"status": "building", "person": person, "memories": memories}
        except ModuleNotFoundError:
            pass

    return {**st, "person": person, "memories": memories}


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

    meta_mtime = (idx_dir / "meta.json").stat().st_mtime
    cached = _INDEX_CACHE.get(body.job_id)
    if cached is None or cached[0] != meta_mtime:
        from second_soul_twin import TwinIndex
        idx = TwinIndex.load(idx_dir)
        _INDEX_CACHE[body.job_id] = (meta_mtime, idx)
    else:
        idx = cached[1]

    # o nome pode vir da separação de vozes (import) OU do perfil (fluxo novo)
    name = "a pessoa"
    for fname, key in (("pessoa.json", "name"), ("perfil.json", "name")):
        f = d / fname
        if f.exists():
            try:
                v = json.loads(f.read_text(encoding="utf-8")).get(key)
                if v:
                    name = v
                    break
            except Exception:
                pass

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
                              style=p.get("style", ""),
                              album=p.get("album"))
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)

    # a geração pode falhar por rate limit ou instabilidade do provedor.
    # sem tratamento, isso virava HTTP 500 -> "NetworkError" no navegador,
    # sem pista do que aconteceu. Aqui tentamos de novo uma vez e, se ainda
    # falhar, devolvemos uma mensagem clara em vez de derrubar a conversa.
    import asyncio

    last_error = ""
    for attempt in range(2):
        try:
            resp = await client.chat.completions.create(
                model=settings.GROQ_MODEL, messages=messages,
                temperature=0.7, max_tokens=1024,
            )
            return {
                "message": resp.choices[0].message.content or "",
                "grounded_on": len(hits),
                "model": settings.GROQ_MODEL,
            }
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status == 429 and attempt == 0:
                await asyncio.sleep(2.0)  # rate limit: espera e tenta de novo
                continue
            break

    detail = ("Muitas perguntas em pouco tempo — espere alguns segundos e "
              "tente de novo." if "429" in last_error or "rate" in last_error.lower()
              else "A essência não conseguiu responder agora. Tente de novo em "
                   "instantes.")
    raise HTTPException(503, detail)
