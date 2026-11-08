"""Camada de banco async (SQLAlchemy 2.0 + asyncpg).

O Railway entrega DATABASE_URL como postgresql://…; o driver async exige
postgresql+asyncpg://…. Normalizamos aqui para não depender de o valor da
variável vir no formato certo.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncSession, async_sessionmaker, create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _async_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):  # algumas plataformas usam este prefixo
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


DATABASE_URL = _async_url(settings.DATABASE_URL)

engine = create_async_engine(DATABASE_URL, echo=settings.DEBUG, future=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session


# colunas acrescentadas a `accounts` DEPOIS da tabela existir em produção.
# create_all cria tabelas novas, mas NÃO altera as já existentes — então estas
# precisam de um ALTER idempotente. Só roda no Postgres (ADD COLUMN IF NOT EXISTS).
_ACCOUNT_MIGRATIONS = (
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT ''",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plan_status VARCHAR(20) DEFAULT ''",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(64)",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(64)",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ",
)


async def init_models() -> None:
    """Cria as tabelas se ainda não existem e aplica micro-migrações de coluna.

    Importa os modelos antes do create_all para que estejam registrados no
    metadata. Idempotente: create_all não recria o que já existe; os ALTER usam
    IF NOT EXISTS e só rodam no Postgres.
    """
    from sqlalchemy import text

    from app.models import account  # noqa: F401  (registra as tabelas)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if conn.dialect.name == "postgresql":
            for stmt in _ACCOUNT_MIGRATIONS:
                await conn.execute(text(stmt))
