"""In-app notifications."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.social import Notification
from app.models.user import User
from app.schemas.social import NotificationOut, UnreadCount

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(Notification).where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * size).limit(size)
    )).scalars().all()
    return [NotificationOut(
        id=r.id, type=r.type, title=r.title, body=r.body,
        entity_type=r.entity_type, entity_id=r.entity_id,
        is_read=r.is_read, created_at=r.created_at,
    ) for r in rows]


@router.get("/unread", response_model=UnreadCount)
async def unread_count(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    count = (await db.execute(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
    )).scalar_one()
    return UnreadCount(count=count)


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}
