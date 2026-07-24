"""Entry point da API Second Soul.

Correções vs. spec:
  - Removido `app.mount("/ws", sio_app)`: `sio_app` (Socket.IO) nunca foi
    definido nem estava nas dependências. WebSocket entra depois como rota
    FastAPI nativa, sem Socket.IO, evitando dependência fantasma.
  - `settings.FRONTEND_URL` agora existe (era referenciado sem estar definido).
  - `create_all` no lifespan só roda em DEBUG; em prod usa Alembic.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.DEBUG:
        # Em dev, cria tabelas na subida. Em prod: `alembic upgrade head`.
        try:
            from app.core.database import Base, engine

            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        except Exception as exc:  # DB pode não estar de pé em dev local puro
            print(f"[startup] DB indisponível ({exc}); seguindo sem criar tabelas.")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    # documentação exposta só quando pedida de propósito (EXPOSE_DOCS=true)
    docs_url="/docs" if os.environ.get("EXPOSE_DOCS") == "true" else None,
    redoc_url=None,
)

def _allowed_origins() -> list[str]:
    """Origens autorizadas — restritivo por padrão.

    Antes isto dependia de ENVIRONMENT=prod para deixar de aceitar qualquer
    origem. Segurança não pode depender de alguém lembrar de configurar uma
    variável: o padrão é fechado, e só o site declarado (mais o localhost do
    desenvolvimento) passa.
    """
    origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
    front = (settings.FRONTEND_URL or "").strip().rstrip("/")
    if front and front not in origins:
        origins.append(front)
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    # a Vercel gera um endereco por deploy alem do principal
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def root_health():
    """Inclui onde as essências estão gravadas.

    Persistência silenciosamente quebrada (dados fora do volume) apagava tudo
    a cada redeploy. Agora dá para verificar num olhar: `persistent: true`."""
    from app.core import sessions

    root = sessions.SESSIONS_ROOT
    return {
        "status": "ok",
        "version": settings.VERSION,
        "env": settings.ENVIRONMENT,
        "storage": str(root),
        "persistent": str(root).startswith("/data"),
        "sessions": sum(1 for _ in root.glob("*")) if root.is_dir() else 0,
    }
