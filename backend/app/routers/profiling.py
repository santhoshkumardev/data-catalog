"""Column profiling stats — store/retrieve."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_steward
from app.database import get_db
from app.models.governance import ColumnProfile
from app.models.user import User
from app.schemas.governance import ColumnProfileCreate, ColumnProfileOut

router = APIRouter(prefix="/api/v1/profiling", tags=["profiling"])


@router.get("/columns/{column_id}", response_model=ColumnProfileOut | None)
async def get_profile(
    column_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = (await db.execute(select(ColumnProfile).where(ColumnProfile.column_id == column_id))).scalar_one_or_none()
    if row is None:
        return None
    return row


@router.put("/columns/{column_id}", response_model=ColumnProfileOut)
async def upsert_profile(
    column_id: uuid.UUID, payload: ColumnProfileCreate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    existing = (await db.execute(select(ColumnProfile).where(ColumnProfile.column_id == column_id))).scalar_one_or_none()
    if existing:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(existing, field, value)
        existing.profiled_at = datetime.now(timezone.utc)
        existing.profiled_by = current_user.id
        row = existing
    else:
        row = ColumnProfile(
            column_id=column_id, profiled_at=datetime.now(timezone.utc),
            profiled_by=current_user.id, **payload.model_dump(),
        )
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return row
