"""Contas e login — a fundação do motor de acesso.

  POST /auth/register  -> cria conta, devolve token
  POST /auth/login     -> valida senha, devolve token
  GET  /auth/me        -> quem é o portador do token

O token é um JWT assinado (HS256) com o id da conta no 'sub'. As etapas
seguintes (papéis, convites, liberação) usam a dependência current_account.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import sessions
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, decode_token, hash_password, verify_password
from app.models.account import Account, ArchiveLink, LinkStatus

router = APIRouter(prefix="/auth", tags=["Contas"])


def is_admin(acc: Account) -> bool:
    """Conta administradora? (definida em ADMIN_EMAILS)."""
    admins = {e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()}
    return bool(admins) and acc.email in admins


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    name: str = Field(default="", max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    account_id: str
    email: str
    name: str


async def current_account(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
) -> Account:
    """Dependência: resolve a conta do token Bearer. 401 se inválido."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Faça login para continuar.")
    token = authorization[7:].strip()
    try:
        payload = decode_token(token)
        account_id = payload.get("sub", "")
    except Exception:
        raise HTTPException(401, "Sessão expirada. Entre de novo.")
    acc = await db.get(Account, account_id)
    if acc is None:
        raise HTTPException(401, "Conta não encontrada.")
    return acc


async def current_admin(acc: Account = Depends(current_account)) -> Account:
    """Dependência: exige que o portador do token seja admin. 403 se não for."""
    if not is_admin(acc):
        raise HTTPException(403, "Acesso restrito ao administrador.")
    return acc


async def archive_access(
    job_id: str,
    acc: Account = Depends(current_account),
    db: AsyncSession = Depends(get_db),
) -> ArchiveLink | None:
    """Dependência: a conta tem acesso LIBERADO a este acervo?

    Regras:
      - admin passa sempre (para suporte e painel);
      - sem vínculo -> 403 (não revela se o acervo existe);
      - vínculo adormecido (herdeiro antes da liberação) -> 403;
      - vínculo ativo -> devolve o vínculo (o papel vem junto).

    Ainda NÃO está acoplada aos endpoints de leitura — isso é a etapa 2.3,
    quando o front já manda o token. Fica pronta aqui para não reescrever
    depois.
    """
    link = await db.scalar(
        select(ArchiveLink).where(
            ArchiveLink.account_id == acc.id, ArchiveLink.job_id == job_id
        )
    )
    if link is None:
        if is_admin(acc):
            return None  # admin sem vínculo explícito: acesso de suporte
        raise HTTPException(403, "Você não tem acesso a este acervo.")
    if link.status == LinkStatus.dormant:
        raise HTTPException(403, "Este acervo ainda não foi liberado.")
    return link


@router.post("/register", response_model=TokenOut)
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    exists = await db.scalar(select(Account).where(Account.email == email))
    if exists is not None:
        raise HTTPException(409, "Já existe uma conta com esse e-mail.")
    acc = Account(email=email, password_hash=hash_password(body.password),
                  name=body.name.strip())
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return TokenOut(token=create_access_token(acc.id), account_id=acc.id,
                    email=acc.email, name=acc.name)


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    acc = await db.scalar(select(Account).where(Account.email == email))
    if acc is None or not verify_password(body.password, acc.password_hash):
        # mensagem única para não revelar se o e-mail existe
        raise HTTPException(401, "E-mail ou senha incorretos.")
    return TokenOut(token=create_access_token(acc.id), account_id=acc.id,
                    email=acc.email, name=acc.name)


class MeOut(BaseModel):
    account_id: str
    email: str
    name: str
    is_admin: bool = False


@router.get("/me", response_model=MeOut)
async def me(acc: Account = Depends(current_account)):
    return MeOut(account_id=acc.id, email=acc.email, name=acc.name, is_admin=is_admin(acc))


class ArchiveOut(BaseModel):
    job_id: str
    role: str
    status: str
    can_reinvite: bool
    person_name: str
    twin_ready: bool


@router.get("/me/archives", response_model=list[ArchiveOut])
async def my_archives(
    acc: Account = Depends(current_account),
    db: AsyncSession = Depends(get_db),
):
    """Os acervos a que esta conta tem acesso, com papel e nome da pessoa."""
    links = (
        await db.scalars(
            select(ArchiveLink).where(ArchiveLink.account_id == acc.id)
        )
    ).all()
    out: list[ArchiveOut] = []
    for lk in links:
        st = sessions.state(lk.job_id)
        out.append(ArchiveOut(
            job_id=lk.job_id,
            role=lk.role.value,
            status=lk.status.value,
            can_reinvite=lk.can_reinvite,
            person_name=st.get("person_name", "") if st.get("found") else "",
            twin_ready=bool(st.get("twin_ready")) if st.get("found") else False,
        ))
    return out
