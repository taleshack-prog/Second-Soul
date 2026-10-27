"""Painel do administrador — vínculos de acesso aos acervos.

Decidido com Tales (out/2026): os acervos que já existem (criados antes das
contas) ganham dono MANUALMENTE. O admin vê todos os acervos do volume, com o
dono atual (se houver), e atribui um dono por e-mail.

  GET    /admin/archives        -> todos os acervos do volume + vínculos
  POST   /admin/link            -> atribui/atualiza acesso (por e-mail)
  DELETE /admin/link            -> remove um vínculo

Só contas em ADMIN_EMAILS entram aqui (dependência current_admin).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import current_admin
from app.core import sessions
from app.core.database import get_db
from app.models.account import Account, ArchiveLink, LinkStatus, Role

router = APIRouter(prefix="/admin", tags=["Admin"])


class LinkView(BaseModel):
    account_id: str
    email: str
    name: str
    role: str
    status: str
    can_reinvite: bool


class ArchiveView(BaseModel):
    job_id: str
    person_name: str
    step: int
    twin_ready: bool
    owner_email: str  # vazio se o acervo ainda não tem dono
    links: list[LinkView]


@router.get("/archives", response_model=list[ArchiveView])
async def list_archives(
    _admin: Account = Depends(current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Varre o volume e cruza cada acervo com seus vínculos no banco."""
    root = sessions.SESSIONS_ROOT
    job_ids = sorted(p.name for p in root.glob("*") if p.is_dir()) if root.is_dir() else []

    # carrega todos os vínculos + contas de uma vez (evita N+1)
    all_links = (await db.scalars(select(ArchiveLink))).all()
    links_by_job: dict[str, list[ArchiveLink]] = {}
    for lk in all_links:
        links_by_job.setdefault(lk.job_id, []).append(lk)
    acc_ids = {lk.account_id for lk in all_links}
    accounts: dict[str, Account] = {}
    if acc_ids:
        for a in (await db.scalars(select(Account).where(Account.id.in_(acc_ids)))).all():
            accounts[a.id] = a

    out: list[ArchiveView] = []
    for job_id in job_ids:
        st = sessions.state(job_id)
        lks = links_by_job.get(job_id, [])
        views: list[LinkView] = []
        owner_email = ""
        for lk in lks:
            a = accounts.get(lk.account_id)
            email = a.email if a else "(conta removida)"
            if lk.role == Role.owner:
                owner_email = email
            views.append(LinkView(
                account_id=lk.account_id, email=email,
                name=a.name if a else "", role=lk.role.value,
                status=lk.status.value, can_reinvite=lk.can_reinvite,
            ))
        out.append(ArchiveView(
            job_id=job_id,
            person_name=st.get("person_name", "") if st.get("found") else "",
            step=st.get("step", 0) if st.get("found") else 0,
            twin_ready=bool(st.get("twin_ready")) if st.get("found") else False,
            owner_email=owner_email,
            links=views,
        ))
    return out


class LinkIn(BaseModel):
    job_id: str
    email: EmailStr
    role: Role = Role.owner
    status: LinkStatus = LinkStatus.active
    can_reinvite: bool = False


@router.post("/link", response_model=LinkView)
async def assign_link(body: LinkIn, _admin: Account = Depends(current_admin),
                      db: AsyncSession = Depends(get_db)):
    """Atribui (ou atualiza) o acesso de uma conta a um acervo.

    O acervo precisa existir no volume e a conta precisa existir (a pessoa
    cria a conta primeiro; o admin então liga as duas pontas).
    """
    if not sessions.exists(body.job_id):
        raise HTTPException(404, "Esse acervo não existe no volume.")
    email = body.email.strip().lower()
    acc = await db.scalar(select(Account).where(Account.email == email))
    if acc is None:
        raise HTTPException(404, "Não há conta com esse e-mail. Peça para a "
                                 "pessoa se cadastrar primeiro.")

    # um acervo só pode ter UM dono: se este vínculo for de dono, recusa se já
    # houver outro dono (evita atribuir a posse em cima de alguém sem querer).
    if body.role == Role.owner:
        existing_owner = await db.scalar(
            select(ArchiveLink).where(
                ArchiveLink.job_id == body.job_id,
                ArchiveLink.role == Role.owner,
                ArchiveLink.account_id != acc.id,
            )
        )
        if existing_owner is not None:
            raise HTTPException(409, "Esse acervo já tem um dono. Remova o "
                                     "vínculo atual antes de trocar.")

    link = await db.scalar(
        select(ArchiveLink).where(
            ArchiveLink.account_id == acc.id, ArchiveLink.job_id == body.job_id
        )
    )
    if link is None:
        link = ArchiveLink(account_id=acc.id, job_id=body.job_id, role=body.role,
                           status=body.status, can_reinvite=body.can_reinvite)
        db.add(link)
    else:  # atualiza o vínculo existente
        link.role = body.role
        link.status = body.status
        link.can_reinvite = body.can_reinvite
    await db.commit()
    await db.refresh(link)
    return LinkView(account_id=acc.id, email=acc.email, name=acc.name,
                    role=link.role.value, status=link.status.value,
                    can_reinvite=link.can_reinvite)


class UnlinkIn(BaseModel):
    job_id: str
    email: EmailStr


@router.delete("/link")
async def remove_link(body: UnlinkIn, _admin: Account = Depends(current_admin),
                      db: AsyncSession = Depends(get_db)):
    """Remove o acesso de uma conta a um acervo."""
    email = body.email.strip().lower()
    acc = await db.scalar(select(Account).where(Account.email == email))
    if acc is None:
        raise HTTPException(404, "Não há conta com esse e-mail.")
    link = await db.scalar(
        select(ArchiveLink).where(
            ArchiveLink.account_id == acc.id, ArchiveLink.job_id == body.job_id
        )
    )
    if link is None:
        raise HTTPException(404, "Essa conta não tem vínculo com esse acervo.")
    await db.delete(link)
    await db.commit()
    return {"removed": True, "job_id": body.job_id, "email": email}
