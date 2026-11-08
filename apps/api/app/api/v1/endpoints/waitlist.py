"""Lista de espera da landing.

Sem freemium e sem Stripe ainda: a landing capta interesse aqui. O POST é
público (qualquer visitante entra); a listagem é só do admin.

  POST /waitlist          -> entra na lista (idempotente por e-mail)
  GET  /waitlist/admin    -> admin vê os inscritos
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import current_admin
from app.core.database import get_db
from app.models.account import Account, Waitlist

router = APIRouter(prefix="/waitlist", tags=["Lista de espera"])

_PLANS = {"", "premium", "vitalicio", "heranca"}


class JoinIn(BaseModel):
    email: EmailStr
    name: str = Field(default="", max_length=200)
    plan_interest: str = Field(default="", max_length=40)
    source: str = Field(default="lp", max_length=80)


@router.post("")
async def join(body: JoinIn, db: AsyncSession = Depends(get_db)):
    """Entra na lista. Idempotente: e-mail repetido não duplica nem vaza erro."""
    email = body.email.strip().lower()
    plan = body.plan_interest.strip().lower()
    if plan not in _PLANS:
        plan = ""
    existing = await db.scalar(select(Waitlist).where(Waitlist.email == email))
    if existing is not None:
        # já estava na lista — resposta igual, para não revelar quem já entrou
        return {"joined": True, "already": True}
    row = Waitlist(email=email, name=body.name.strip(), plan_interest=plan,
                   source=body.source.strip()[:80] or "lp")
    db.add(row)
    await db.commit()
    return {"joined": True, "already": False}


class WaitlistRow(BaseModel):
    email: str
    name: str
    plan_interest: str
    source: str
    created_at: str


@router.get("/admin", response_model=list[WaitlistRow])
async def list_all(_admin: Account = Depends(current_admin),
                   db: AsyncSession = Depends(get_db)):
    """Todos os inscritos, mais recentes primeiro."""
    rows = (await db.scalars(
        select(Waitlist).order_by(Waitlist.created_at.desc())
    )).all()
    return [
        WaitlistRow(email=r.email, name=r.name, plan_interest=r.plan_interest,
                    source=r.source, created_at=r.created_at.isoformat())
        for r in rows
    ]
