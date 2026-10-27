"""Modelos de conta e acesso — o motor de herança do Second Soul.

Desenho (decidido com Tales, out/2026):

  Account      — pessoa com login (e-mail + senha). Dono ou convidado.
  ArchiveLink  — vincula uma conta a um acervo (job_id nos arquivos do volume),
                 com um papel e permissões. Um acervo tem um dono e N acessos.
  Invite       — convite pendente (por e-mail ou por link), que ao ser aceito
                 vira um ArchiveLink.
  ReleaseRequest — pedido de liberação pós-morte: executor declara o óbito,
                 anexa documento, cai no painel do admin para aprovação.

Os ACERVOS continuam nos arquivos do volume (/data/sessions/<job_id>). Só as
contas, papéis, convites e pedidos vivem no Postgres.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, String, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    owner = "owner"        # criou o acervo; única conta que edita
    guest = "guest"        # convidado em vida; conversa agora, só lê
    heir = "heir"          # herdeiro; adormecido até a liberação pós-morte
    executor = "executor"  # pode declarar o óbito do titular


class LinkStatus(str, enum.Enum):
    active = "active"      # acesso liberado
    dormant = "dormant"    # herdeiro à espera da liberação pós-morte


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    links: Mapped[list["ArchiveLink"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class ArchiveLink(Base):
    """Uma conta tem acesso a um acervo, com um papel."""

    __tablename__ = "archive_links"
    __table_args__ = (UniqueConstraint("account_id", "job_id", name="uq_account_job"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    account_id: Mapped[str] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    job_id: Mapped[str] = mapped_column(String(64), index=True)  # acervo no volume
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"))
    status: Mapped[LinkStatus] = mapped_column(
        Enum(LinkStatus, name="link_status"), default=LinkStatus.active
    )
    # o dono pode marcar um acesso como "pode reconvidar" (corrente familiar)
    can_reinvite: Mapped[bool] = mapped_column(Boolean, default=False)
    # quem concedeu este acesso (para desenhar a árvore de convites)
    invited_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    account: Mapped["Account"] = relationship(back_populates="links")


class InviteKind(str, enum.Enum):
    now = "now"          # acesso em vida (vira guest, ativo)
    dormant = "dormant"  # guardado para depois (vira heir, adormecido)


class Invite(Base):
    """Convite pendente. Vira um ArchiveLink quando aceito."""

    __tablename__ = "invites"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    token: Mapped[str] = mapped_column(String(48), unique=True, index=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(64), index=True)
    kind: Mapped[InviteKind] = mapped_column(Enum(InviteKind, name="invite_kind"))
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"))
    # e-mail do convidado (quando o convite é por e-mail); vazio se for só por link
    email: Mapped[str] = mapped_column(String(320), default="")
    can_reinvite: Mapped[bool] = mapped_column(Boolean, default=False)
    invited_by_account: Mapped[str] = mapped_column(String(32))  # quem convidou
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ReleaseStatus(str, enum.Enum):
    pending = "pending"    # aguardando aprovação do admin
    approved = "approved"  # liberado; herdeiros despertaram
    rejected = "rejected"  # recusado (ex.: documento inválido, titular vivo)


class ReleaseRequest(Base):
    """Pedido de liberação pós-morte, aprovado no painel do admin."""

    __tablename__ = "release_requests"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(64), index=True)
    requested_by_account: Mapped[str] = mapped_column(String(32))  # o executor
    document_note: Mapped[str] = mapped_column(String(1000), default="")  # ref. da certidão
    status: Mapped[ReleaseStatus] = mapped_column(
        Enum(ReleaseStatus, name="release_status"), default=ReleaseStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
