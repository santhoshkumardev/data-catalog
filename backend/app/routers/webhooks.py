"""Webhooks — CRUD subscriptions, delivery history."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_steward
from app.database import get_db
from app.models.user import User
from app.models.webhooks import Webhook, WebhookEvent
from app.schemas.webhooks import (
    PaginatedWebhookEvents, WebhookCreate, WebhookEventOut,
    WebhookOut, WebhookPatch,
)

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


@router.get("", response_model=list[WebhookOut])
async def list_webhooks(db: AsyncSession = Depends(get_db), _: User = Depends(require_steward)):
    rows = (await db.execute(select(Webhook).order_by(Webhook.created_at.desc()))).scalars().all()
    items = []
    for row in rows:
        await db.refresh(row, ["creator"])
        items.append(WebhookOut(
            id=row.id, name=row.name, url=row.url, events=row.events,
            is_active=row.is_active, created_by=row.created_by,
            creator_name=row.creator.name if row.creator else None,
            created_at=row.created_at,
        ))
    return items


@router.post("", response_model=WebhookOut, status_code=201)
async def create_webhook(
    payload: WebhookCreate, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_steward),
):
    wh = Webhook(
        name=payload.name, url=payload.url, secret=payload.secret,
        events=payload.events, is_active=payload.is_active,
        created_by=current_user.id,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh, ["creator"])
    return WebhookOut(
        id=wh.id, name=wh.name, url=wh.url, events=wh.events,
        is_active=wh.is_active, created_by=wh.created_by,
        creator_name=wh.creator.name if wh.creator else None,
        created_at=wh.created_at,
    )


@router.patch("/{webhook_id}", response_model=WebhookOut)
async def update_webhook(
    webhook_id: uuid.UUID, patch: WebhookPatch,
    db: AsyncSession = Depends(get_db), _: User = Depends(require_steward),
):
    wh = (await db.execute(select(Webhook).where(Webhook.id == webhook_id))).scalar_one_or_none()
    if wh is None:
        raise HTTPException(status_code=404, detail="Webhook not found")
    for field, value in patch.model_dump(exclude_unset=True).items():
        setattr(wh, field, value)
    await db.commit()
    await db.refresh(wh, ["creator"])
    return WebhookOut(
        id=wh.id, name=wh.name, url=wh.url, events=wh.events,
        is_active=wh.is_active, created_by=wh.created_by,
        creator_name=wh.creator.name if wh.creator else None,
        created_at=wh.created_at,
    )


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    _: User = Depends(require_steward),
):
    wh = (await db.execute(select(Webhook).where(Webhook.id == webhook_id))).scalar_one_or_none()
    if wh is None:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.delete(wh)
    await db.commit()


@router.get("/{webhook_id}/events", response_model=PaginatedWebhookEvents)
async def list_events(
    webhook_id: uuid.UUID, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db), _: User = Depends(require_steward),
):
    total = (await db.execute(select(func.count()).select_from(WebhookEvent).where(WebhookEvent.webhook_id == webhook_id))).scalar_one()
    rows = (await db.execute(
        select(WebhookEvent).where(WebhookEvent.webhook_id == webhook_id)
        .order_by(WebhookEvent.created_at.desc()).offset((page - 1) * size).limit(size)
    )).scalars().all()
    return PaginatedWebhookEvents(total=total, page=page, size=size, items=list(rows))
