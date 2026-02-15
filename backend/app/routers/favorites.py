"""Favorites/bookmarks for any entity."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.social import Favorite
from app.models.user import User
from app.schemas.social import FavoriteOut, FavoriteStatus

router = APIRouter(prefix="/api/v1/favorites", tags=["favorites"])


@router.get("", response_model=list[FavoriteOut])
async def list_favorites(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(Favorite).where(Favorite.user_id == current_user.id).order_by(Favorite.created_at.desc())
    )).scalars().all()
    return [FavoriteOut(id=r.id, entity_type=r.entity_type, entity_id=r.entity_id, created_at=r.created_at) for r in rows]


@router.get("/{entity_type}/{entity_id}", response_model=FavoriteStatus)
async def check_favorite(
    entity_type: str, entity_id: str,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    fav = (await db.execute(
        select(Favorite).where(Favorite.entity_type == entity_type, Favorite.entity_id == entity_id, Favorite.user_id == current_user.id)
    )).scalar_one_or_none()
    return FavoriteStatus(is_favorited=fav is not None)


@router.post("/{entity_type}/{entity_id}", response_model=FavoriteStatus)
async def toggle_favorite(
    entity_type: str, entity_id: str,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    existing = (await db.execute(
        select(Favorite).where(Favorite.entity_type == entity_type, Favorite.entity_id == entity_id, Favorite.user_id == current_user.id)
    )).scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
        return FavoriteStatus(is_favorited=False)
    else:
        fav = Favorite(entity_type=entity_type, entity_id=entity_id, user_id=current_user.id)
        db.add(fav)
        await db.commit()
        return FavoriteStatus(is_favorited=True)
