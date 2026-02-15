"""Comments on any entity."""
import uuid

import nh3
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.social import Comment
from app.models.user import User
from app.schemas.social import CommentCreate, CommentOut
from app.services.notifications import create_notification

router = APIRouter(prefix="/api/v1/comments", tags=["comments"])


@router.get("/{entity_type}/{entity_id}", response_model=list[CommentOut])
async def list_comments(
    entity_type: str, entity_id: str,
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(Comment).where(Comment.entity_type == entity_type, Comment.entity_id == entity_id, Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.desc())
    )).scalars().all()
    items = []
    for row in rows:
        await db.refresh(row, ["user"])
        items.append(CommentOut(
            id=row.id, entity_type=row.entity_type, entity_id=row.entity_id,
            user_id=row.user_id, user_name=row.user.name if row.user else None,
            body=row.body, created_at=row.created_at, updated_at=row.updated_at,
        ))
    return items


@router.post("/{entity_type}/{entity_id}", response_model=CommentOut, status_code=201)
async def add_comment(
    entity_type: str, entity_id: str, payload: CommentCreate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    body = nh3.clean(payload.body)
    comment = Comment(entity_type=entity_type, entity_id=entity_id, user_id=current_user.id, body=body)
    db.add(comment)
    await db.commit()
    await db.refresh(comment, ["user"])
    return CommentOut(
        id=comment.id, entity_type=comment.entity_type, entity_id=comment.entity_id,
        user_id=comment.user_id, user_name=current_user.name,
        body=comment.body, created_at=comment.created_at, updated_at=comment.updated_at,
    )


@router.delete("/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    comment = (await db.execute(select(Comment).where(Comment.id == comment_id, Comment.deleted_at.is_(None)))).scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id and current_user.role != "steward":
        raise HTTPException(status_code=403, detail="Not authorized")
    comment.deleted_at = datetime.now(timezone.utc)
    await db.commit()
