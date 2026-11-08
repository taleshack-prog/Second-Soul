"""Cobrança via Stripe (modo teste até lançar).

Fluxo:
  POST /billing/checkout  -> cria a sessão de checkout, devolve a URL
  POST /billing/webhook   -> Stripe avisa pagamento/assinatura; atualiza a conta
  GET  /billing/status    -> plano e situação da conta logada

Os produtos/preços são criados no Stripe automaticamente na primeira vez
(idempotente por lookup_key) — não precisa montá-los à mão no painel.

As chamadas ao Stripe são síncronas; rodamos em threadpool para não travar o
loop async. Nada funciona sem STRIPE_SECRET_KEY definido no ambiente.
"""

from __future__ import annotations

from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.api.v1.endpoints.auth import current_account
from app.core.config import settings
from app.core.database import get_db
from app.models.account import Account

router = APIRouter(prefix="/billing", tags=["Cobrança"])


# plano do checkout -> (lookup_key, modo, recorrência)
_PLANS = {
    "premium_month": {"lookup": "ss_premium_month", "mode": "subscription",
                      "amount": settings.PREMIUM_MONTH_CENTS, "interval": "month",
                      "product": "Second Soul Premium"},
    "premium_year": {"lookup": "ss_premium_year", "mode": "subscription",
                     "amount": settings.PREMIUM_YEAR_CENTS, "interval": "year",
                     "product": "Second Soul Premium"},
    "heranca": {"lookup": "ss_heranca", "mode": "payment",
                "amount": settings.HERANCA_CENTS, "interval": None,
                "product": "Second Soul Herança"},
}

_price_cache: dict[str, str] = {}  # plano -> price_id (resolvido uma vez)


def _require_stripe() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(503, "Cobrança ainda não configurada.")
    stripe.api_key = settings.STRIPE_SECRET_KEY


def _resolve_price_sync(plan_key: str) -> str:
    """Acha (ou cria) o preço no Stripe pelo lookup_key. Idempotente."""
    if plan_key in _price_cache:
        return _price_cache[plan_key]
    spec = _PLANS[plan_key]
    found = stripe.Price.list(lookup_keys=[spec["lookup"]], limit=1, active=True)
    if found.data:
        _price_cache[plan_key] = found.data[0].id
        return found.data[0].id
    # cria o produto (ou reusa por nome não é garantido; criamos e deixamos o
    # Stripe deduplicar visualmente — em teste tudo bem) e o preço
    product = stripe.Product.create(name=spec["product"])
    price_kwargs = {
        "product": product.id,
        "currency": settings.CURRENCY,
        "unit_amount": spec["amount"],
        "lookup_key": spec["lookup"],
    }
    if spec["interval"]:
        price_kwargs["recurring"] = {"interval": spec["interval"]}
    price = stripe.Price.create(**price_kwargs)
    _price_cache[plan_key] = price.id
    return price.id


class CheckoutIn(BaseModel):
    plan: str  # premium_month | premium_year | heranca


@router.post("/checkout")
async def checkout(body: CheckoutIn, acc: Account = Depends(current_account),
                   db: AsyncSession = Depends(get_db)):
    _require_stripe()
    if body.plan not in _PLANS:
        raise HTTPException(422, "Plano inválido.")
    spec = _PLANS[body.plan]

    # garante um cliente Stripe para a conta
    if not acc.stripe_customer_id:
        customer = await run_in_threadpool(
            lambda: stripe.Customer.create(
                email=acc.email, name=acc.name or None,
                metadata={"account_id": acc.id},
            )
        )
        acc.stripe_customer_id = customer.id
        await db.commit()

    price_id = await run_in_threadpool(_resolve_price_sync, body.plan)

    front = (settings.FRONTEND_URL or "").rstrip("/")
    session = await run_in_threadpool(
        lambda: stripe.checkout.Session.create(
            customer=acc.stripe_customer_id,
            mode=spec["mode"],
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{front}/meus-acervos?assinatura=ok",
            cancel_url=f"{front}/lp",
            metadata={"account_id": acc.id, "plan": body.plan},
            subscription_data=(
                {"metadata": {"account_id": acc.id}}
                if spec["mode"] == "subscription" else None
            ),
            allow_promotion_codes=True,
        )
    )
    return {"url": session.url}


def _plan_family(plan_key: str) -> str:
    return "heranca" if plan_key == "heranca" else "premium"


async def _account_by(db: AsyncSession, *, account_id: str | None,
                      customer_id: str | None) -> Account | None:
    if account_id:
        acc = await db.get(Account, account_id)
        if acc:
            return acc
    if customer_id:
        return await db.scalar(
            select(Account).where(Account.stripe_customer_id == customer_id)
        )
    return None


@router.post("/webhook")
async def webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Stripe chama aqui. Verifica a assinatura e atualiza a conta."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook não configurado.")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(400, "Assinatura do webhook inválida.")

    typ = event["type"]
    obj = event["data"]["object"]

    if typ == "checkout.session.completed":
        meta = obj.get("metadata") or {}
        acc = await _account_by(db, account_id=meta.get("account_id"),
                                customer_id=obj.get("customer"))
        if acc:
            acc.plan = _plan_family(meta.get("plan", ""))
            acc.plan_status = "active"
            if obj.get("customer"):
                acc.stripe_customer_id = obj["customer"]
            if obj.get("subscription"):
                acc.stripe_subscription_id = obj["subscription"]
            await db.commit()

    elif typ in ("customer.subscription.updated", "customer.subscription.deleted"):
        meta = obj.get("metadata") or {}
        acc = await _account_by(db, account_id=meta.get("account_id"),
                                customer_id=obj.get("customer"))
        if acc:
            status = obj.get("status", "")
            # mapeia o status do Stripe para o nosso
            if typ.endswith("deleted") or status == "canceled":
                acc.plan_status = "canceled"
            elif status in ("active", "trialing"):
                acc.plan_status = "active"
            elif status in ("past_due", "unpaid"):
                acc.plan_status = "past_due"
            acc.stripe_subscription_id = obj.get("id")
            cpe = obj.get("current_period_end")
            if cpe:
                acc.current_period_end = datetime.fromtimestamp(cpe, tz=timezone.utc)
            await db.commit()

    elif typ == "invoice.payment_failed":
        acc = await _account_by(db, account_id=None, customer_id=obj.get("customer"))
        if acc:
            acc.plan_status = "past_due"
            await db.commit()

    return {"received": True}


class BillingStatus(BaseModel):
    plan: str
    plan_status: str
    current_period_end: str | None


@router.get("/status", response_model=BillingStatus)
async def status(acc: Account = Depends(current_account)):
    return BillingStatus(
        plan=acc.plan,
        plan_status=acc.plan_status,
        current_period_end=(
            acc.current_period_end.isoformat() if acc.current_period_end else None
        ),
    )
