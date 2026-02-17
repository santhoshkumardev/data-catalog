"""Queries — shared SQL query library."""
import uuid
from datetime import datetime, timezone

import nh3
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_steward
from app.database import get_db
from app.models.catalog import DbConnection, Query as QueryModel
from app.models.user import User
from app.schemas.catalog import PaginatedQueries, QueryCreate, QueryOut, QueryPatch
from app.services.audit import log_action
from app.services.search_sync import sync_query_async, remove_document

router = APIRouter(prefix="/api/v1/queries", tags=["queries"])

ALLOWED_PATCH = {"name", "description", "connection_id", "sme_name", "sme_email", "sql_text"}


def _to_out(q: QueryModel) -> QueryOut:
    return QueryOut(
        id=q.id, name=q.name, description=q.description,
        connection_id=q.connection_id,
        database_name=q.connection.name if q.connection else None,
        sme_name=q.sme_name, sme_email=q.sme_email, sql_text=q.sql_text,
        created_by=q.created_by,
        creator_name=q.creator.name if q.creator else None,
        created_at=q.created_at, updated_at=q.updated_at,
    )


@router.get("", response_model=PaginatedQueries)
async def list_queries(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    db_id: uuid.UUID | None = Query(None), q: str | None = Query(None),
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    stmt = select(QueryModel).where(QueryModel.deleted_at.is_(None))
    count_stmt = select(func.count()).select_from(QueryModel).where(QueryModel.deleted_at.is_(None))
    if db_id:
        stmt = stmt.where(QueryModel.connection_id == db_id)
        count_stmt = count_stmt.where(QueryModel.connection_id == db_id)
    if q:
        like_q = f"%{q}%"
        stmt = stmt.where(QueryModel.name.ilike(like_q) | QueryModel.description.ilike(like_q))
        count_stmt = count_stmt.where(QueryModel.name.ilike(like_q) | QueryModel.description.ilike(like_q))
    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt.order_by(QueryModel.updated_at.desc()).offset((page - 1) * size).limit(size))).scalars().all()
    items = []
    for row in rows:
        await db.refresh(row, ["connection", "creator"])
        items.append(_to_out(row))
    return PaginatedQueries(total=total, page=page, size=size, items=items)


@router.post("", response_model=QueryOut, status_code=201)
async def create_query(
    payload: QueryCreate, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_steward),
):
    if payload.connection_id:
        conn = (await db.execute(select(DbConnection).where(DbConnection.id == payload.connection_id))).scalar_one_or_none()
        if conn is None:
            raise HTTPException(status_code=404, detail="Database not found")
    desc = nh3.clean(payload.description) if payload.description else payload.description
    q = QueryModel(
        name=payload.name, description=desc, connection_id=payload.connection_id,
        sme_name=payload.sme_name, sme_email=payload.sme_email,
        sql_text=payload.sql_text, created_by=current_user.id,
    )
    db.add(q)
    await log_action(db, "query", str(q.id), "create", current_user.id, new_data={"name": q.name})
    await db.commit()
    await db.refresh(q, ["connection", "creator"])
    await sync_query_async(q)
    return _to_out(q)


@router.get("/{query_id}", response_model=QueryOut)
async def get_query(query_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    q = (await db.execute(select(QueryModel).where(QueryModel.id == query_id, QueryModel.deleted_at.is_(None)))).scalar_one_or_none()
    if q is None:
        raise HTTPException(status_code=404, detail="Query not found")
    await db.refresh(q, ["connection", "creator"])
    return _to_out(q)


@router.patch("/{query_id}", response_model=QueryOut)
async def patch_query(
    query_id: uuid.UUID, patch: QueryPatch,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    q = (await db.execute(select(QueryModel).where(QueryModel.id == query_id, QueryModel.deleted_at.is_(None)))).scalar_one_or_none()
    if q is None:
        raise HTTPException(status_code=404, detail="Query not found")
    changes = {k: v for k, v in patch.model_dump(exclude_unset=True).items() if k in ALLOWED_PATCH}
    if "description" in changes and changes["description"]:
        changes["description"] = nh3.clean(changes["description"])
    if "connection_id" in changes and changes["connection_id"]:
        conn = (await db.execute(select(DbConnection).where(DbConnection.id == changes["connection_id"]))).scalar_one_or_none()
        if conn is None:
            raise HTTPException(status_code=404, detail="Database not found")
    old_data = {"name": q.name, "description": q.description}
    for field, value in changes.items():
        setattr(q, field, value)
    await log_action(db, "query", str(query_id), "update", current_user.id, old_data, changes)
    await db.commit()
    await db.refresh(q, ["connection", "creator"])
    await sync_query_async(q)
    return _to_out(q)


@router.delete("/{query_id}", status_code=204)
async def delete_query(
    query_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_steward),
):
    q = (await db.execute(select(QueryModel).where(QueryModel.id == query_id, QueryModel.deleted_at.is_(None)))).scalar_one_or_none()
    if q is None:
        raise HTTPException(status_code=404, detail="Query not found")
    q.deleted_at = datetime.now(timezone.utc)
    await log_action(db, "query", str(query_id), "delete", current_user.id, old_data={"name": q.name})
    await db.commit()
    remove_document("queries", str(query_id))
