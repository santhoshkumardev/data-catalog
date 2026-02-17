"""User management, groups, + audit log viewer — admin/steward only."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin, require_steward, get_current_user
from app.database import get_db
from app.models.audit import AuditLog
from app.models.group import Group, UserGroup
from app.models.user import User
from app.schemas.audit import AuditLogOut, PaginatedAuditLogs
from app.schemas.group import GroupCreate, GroupOut, GroupPatch, UserGroupOut, AddMember
from app.redis_client import cache_user_delete
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
    await cache_user_delete(str(user_id))
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


# ─── Groups ──────────────────────────────────────────────────────────────────

VALID_GROUP_ROLES = {"admin", "steward", "viewer"}


@router.get("/groups", response_model=list[GroupOut])
async def list_groups(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    rows = (await db.execute(select(Group).order_by(Group.name))).scalars().all()
    items = []
    for g in rows:
        count = (await db.execute(
            select(func.count()).select_from(UserGroup).where(UserGroup.group_id == g.id)
        )).scalar_one()
        items.append(GroupOut(
            id=g.id, name=g.name, ad_group_name=g.ad_group_name,
            app_role=g.app_role, description=g.description,
            member_count=count, created_at=g.created_at,
        ))
    return items


@router.post("/groups", response_model=GroupOut, status_code=201)
async def create_group(
    payload: GroupCreate, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if payload.app_role not in VALID_GROUP_ROLES:
        raise HTTPException(status_code=400, detail=f"app_role must be one of {VALID_GROUP_ROLES}")
    existing = (await db.execute(select(Group).where(Group.name == payload.name))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Group with this name already exists")
    group = Group(
        name=payload.name, ad_group_name=payload.ad_group_name,
        app_role=payload.app_role, description=payload.description,
    )
    db.add(group)
    await log_action(db, "group", str(group.id), "create", current_user.id, new_data=payload.model_dump())
    await db.commit()
    await db.refresh(group)
    return GroupOut(
        id=group.id, name=group.name, ad_group_name=group.ad_group_name,
        app_role=group.app_role, description=group.description,
        member_count=0, created_at=group.created_at,
    )


@router.patch("/groups/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: uuid.UUID, patch: GroupPatch,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin),
):
    group = (await db.execute(select(Group).where(Group.id == group_id))).scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    changes = patch.model_dump(exclude_unset=True)
    if "app_role" in changes and changes["app_role"] not in VALID_GROUP_ROLES:
        raise HTTPException(status_code=400, detail=f"app_role must be one of {VALID_GROUP_ROLES}")
    for field, value in changes.items():
        setattr(group, field, value)
    await log_action(db, "group", str(group_id), "update", current_user.id, new_data=changes)
    await db.commit()
    await db.refresh(group)
    count = (await db.execute(
        select(func.count()).select_from(UserGroup).where(UserGroup.group_id == group.id)
    )).scalar_one()
    return GroupOut(
        id=group.id, name=group.name, ad_group_name=group.ad_group_name,
        app_role=group.app_role, description=group.description,
        member_count=count, created_at=group.created_at,
    )


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group(
    group_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    group = (await db.execute(select(Group).where(Group.id == group_id))).scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    await log_action(db, "group", str(group_id), "delete", current_user.id)
    await db.delete(group)
    await db.commit()


@router.get("/groups/{group_id}/members", response_model=list[UserGroupOut])
async def list_group_members(
    group_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    group = (await db.execute(select(Group).where(Group.id == group_id))).scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    rows = (await db.execute(select(UserGroup).where(UserGroup.group_id == group_id))).scalars().all()
    items = []
    for ug in rows:
        await db.refresh(ug, ["user"])
        items.append(UserGroupOut(
            id=ug.id, user_id=ug.user_id, user_name=ug.user.name,
            user_email=ug.user.email, synced_at=ug.synced_at,
        ))
    return items


@router.post("/groups/{group_id}/members", response_model=UserGroupOut, status_code=201)
async def add_group_member(
    group_id: uuid.UUID, payload: AddMember,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin),
):
    group = (await db.execute(select(Group).where(Group.id == group_id))).scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    user = (await db.execute(select(User).where(User.id == payload.user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    existing = (await db.execute(
        select(UserGroup).where(UserGroup.user_id == payload.user_id, UserGroup.group_id == group_id)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="User already in group")
    ug = UserGroup(user_id=payload.user_id, group_id=group_id)
    db.add(ug)
    await db.commit()
    await db.refresh(ug, ["user"])
    return UserGroupOut(
        id=ug.id, user_id=ug.user_id, user_name=ug.user.name,
        user_email=ug.user.email, synced_at=ug.synced_at,
    )


@router.delete("/groups/{group_id}/members/{user_id}", status_code=204)
async def remove_group_member(
    group_id: uuid.UUID, user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db), _: User = Depends(require_admin),
):
    ug = (await db.execute(
        select(UserGroup).where(UserGroup.user_id == user_id, UserGroup.group_id == group_id)
    )).scalar_one_or_none()
    if ug is None:
        raise HTTPException(status_code=404, detail="Membership not found")
    await db.delete(ug)
    await db.commit()
