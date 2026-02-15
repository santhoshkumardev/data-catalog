"""User management + audit log viewer — admin/steward only."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin, require_steward, get_current_user
from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogOut, PaginatedAuditLogs
from app.services.audit import log_action
from app.services.search_sync import reindex_all

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: str
    model_config = {"from_attributes": True}


class UserRolePatch(BaseModel):
    role: str


@router.get("/users", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    users = (await db.execute(select(User).order_by(User.email))).scalars().all()
    return list(users)


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: uuid.UUID, patch: UserRolePatch,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin),
):
    valid_roles = {"admin", "steward", "viewer"}
    if patch.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Role must be one of {valid_roles}")
    if user_id == current_user.id and patch.role != current_user.role:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    old_role = user.role
    user.role = patch.role
    await log_action(db, "user", str(user_id), "update", current_user.id, {"role": old_role}, {"role": patch.role})
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/audit", response_model=PaginatedAuditLogs)
async def list_audit_logs(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    entity_type: str | None = Query(None), entity_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db), _: User = Depends(require_steward),
):
    stmt = select(AuditLog)
    count_stmt = select(func.count()).select_from(AuditLog)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
        count_stmt = count_stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
        count_stmt = count_stmt.where(AuditLog.entity_id == entity_id)
    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size))).scalars().all()
    items = []
    for row in rows:
        await db.refresh(row, ["actor"])
        items.append(AuditLogOut(
            id=row.id, entity_type=row.entity_type, entity_id=row.entity_id,
            action=row.action, actor_id=row.actor_id,
            actor_name=row.actor.name if row.actor else None,
            old_data=row.old_data, new_data=row.new_data,
            request_id=row.request_id, created_at=row.created_at,
        ))
    return PaginatedAuditLogs(total=total, page=page, size=size, items=items)


@router.post("/reindex")
async def reindex_search(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_steward),
):
    counts = await reindex_all(db)
    return {"status": "ok", "counts": counts}
