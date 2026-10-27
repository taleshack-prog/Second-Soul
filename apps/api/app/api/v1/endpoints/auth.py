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

from app.core.database import get_db
from app.core.security import create_access_token, decode_token, hash_password, verify_password
from app.models.account import Account

router = APIRouter(prefix="/auth", tags=["Contas"])


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


@router.get("/me", response_model=MeOut)
async def me(acc: Account = Depends(current_account)):
    return MeOut(account_id=acc.id, email=acc.email, name=acc.name)
