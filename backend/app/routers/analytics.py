"""Usage analytics — record views, popular entities, trending."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.social import EntityView
from app.models.user import User

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.post("/view")
async def record_view(
    entity_type: str = Query(...), entity_id: str = Query(...),
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    view = EntityView(entity_type=entity_type, entity_id=entity_id, user_id=current_user.id)
    db.add(view)
    await db.commit()
    return {"status": "ok"}


@router.get("/popular")
async def popular_entities(
    entity_type: str | None = Query(None), limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    stmt = (
        select(EntityView.entity_type, EntityView.entity_id, func.count().label("view_count"))
        .group_by(EntityView.entity_type, EntityView.entity_id)
        .order_by(func.count().desc())
        .limit(limit)
    )
    if entity_type:
        stmt = stmt.where(EntityView.entity_type == entity_type)
    rows = (await db.execute(stmt)).mappings().all()
    return [dict(r) for r in rows]


@router.get("/trending")
async def trending_entities(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=7)
    stmt = (
        select(EntityView.entity_type, EntityView.entity_id, func.count().label("view_count"))
        .where(EntityView.created_at >= since)
        .group_by(EntityView.entity_type, EntityView.entity_id)
        .order_by(func.count().desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return [dict(r) for r in rows]
