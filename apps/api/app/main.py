"""Entry point da API Second Soul.

Correções vs. spec:
  - Removido `app.mount("/ws", sio_app)`: `sio_app` (Socket.IO) nunca foi
    definido nem estava nas dependências. WebSocket entra depois como rota
    FastAPI nativa, sem Socket.IO, evitando dependência fantasma.
  - `settings.FRONTEND_URL` agora existe (era referenciado sem estar definido).
  - `create_all` no lifespan só roda em DEBUG; em prod usa Alembic.
"""

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
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else [settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def root_health():
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
