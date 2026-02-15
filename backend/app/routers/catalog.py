"""Browse and enrichment endpoints for catalog metadata."""
import uuid

import nh3
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user, require_steward
from app.database import get_db
from app.models.catalog import Column, DbConnection, Schema, Table
from app.models.user import User
from app.schemas.catalog import (
    ColumnOut, ColumnPatch,
    DbConnectionOut, DbConnectionPatch,
    PaginatedColumns, PaginatedDbConnections, PaginatedSchemas, PaginatedTables,
    SchemaPatch, SchemaOut,
    TableOut, TablePatch,
)
from app.services.audit import log_action
from app.services.search_sync import sync_database, sync_column, sync_schema, sync_table

router = APIRouter(prefix="/api/v1", tags=["catalog"])

ALLOWED_DB_PATCH = {"description", "tags"}
ALLOWED_SCHEMA_PATCH = {"description", "tags"}
ALLOWED_TABLE_PATCH = {"description", "tags", "sme_name", "sme_email"}
ALLOWED_COLUMN_PATCH = {"description", "tags", "title"}


# ─── Databases ────────────────────────────────────────────────────────────────

@router.get("/databases", response_model=PaginatedDbConnections)
async def list_databases(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: str = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(DbConnection).where(DbConnection.deleted_at.is_(None))
    count_stmt = select(func.count()).select_from(DbConnection).where(DbConnection.deleted_at.is_(None))
    if q:
        like_q = f"%{q}%"
        stmt = stmt.where(DbConnection.name.ilike(like_q) | DbConnection.description.ilike(like_q))
        count_stmt = count_stmt.where(DbConnection.name.ilike(like_q) | DbConnection.description.ilike(like_q))
    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(stmt.offset((page - 1) * size).limit(size))).scalars().all()
    return PaginatedDbConnections(total=total, page=page, size=size, items=list(items))


@router.get("/databases/{db_id}", response_model=DbConnectionOut)
async def get_database(db_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    row = (await db.execute(select(DbConnection).where(DbConnection.id == db_id, DbConnection.deleted_at.is_(None)))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Database not found")
    return row


@router.patch("/databases/{db_id}", response_model=DbConnectionOut)
async def patch_database(
    db_id: uuid.UUID, patch: DbConnectionPatch,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    row = (await db.execute(select(DbConnection).where(DbConnection.id == db_id, DbConnection.deleted_at.is_(None)))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Database not found")
    changes = patch.model_dump(exclude_unset=True)
    changes = {k: v for k, v in changes.items() if k in ALLOWED_DB_PATCH}
    if "description" in changes and changes["description"]:
        changes["description"] = nh3.clean(changes["description"])
    old_data = {"description": row.description, "tags": row.tags}
    for field, value in changes.items():
        setattr(row, field, value)
    await log_action(db, "database", str(db_id), "update", current_user.id, old_data, changes)
    await db.commit()
    await db.refresh(row)
    sync_database(row)
    return row


# ─── Schemas ──────────────────────────────────────────────────────────────────

@router.get("/databases/{db_id}/schemas", response_model=PaginatedSchemas)
async def list_schemas(
    db_id: uuid.UUID, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    base = Schema.connection_id == db_id
    total = (await db.execute(select(func.count()).select_from(Schema).where(base, Schema.deleted_at.is_(None)))).scalar_one()
    items = (await db.execute(select(Schema).where(base, Schema.deleted_at.is_(None)).offset((page - 1) * size).limit(size))).scalars().all()
    return PaginatedSchemas(total=total, page=page, size=size, items=list(items))


@router.get("/schemas/{schema_id}", response_model=SchemaOut)
async def get_schema(schema_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    row = (await db.execute(select(Schema).where(Schema.id == schema_id, Schema.deleted_at.is_(None)))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Schema not found")
    return row


@router.patch("/schemas/{schema_id}", response_model=SchemaOut)
async def patch_schema(
    schema_id: uuid.UUID, patch: SchemaPatch,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    row = (await db.execute(select(Schema).where(Schema.id == schema_id, Schema.deleted_at.is_(None)))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Schema not found")
    changes = {k: v for k, v in patch.model_dump(exclude_unset=True).items() if k in ALLOWED_SCHEMA_PATCH}
    if "description" in changes and changes["description"]:
        changes["description"] = nh3.clean(changes["description"])
    old_data = {"description": row.description, "tags": row.tags}
    for field, value in changes.items():
        setattr(row, field, value)
    await log_action(db, "schema", str(schema_id), "update", current_user.id, old_data, changes)
    await db.commit()
    await db.refresh(row)
    sync_schema(row)
    return row


# ─── Tables ───────────────────────────────────────────────────────────────────

@router.get("/schemas/{schema_id}/tables", response_model=PaginatedTables)
async def list_tables(
    schema_id: uuid.UUID, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    q: str = Query(None),
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    stmt = select(Table).where(Table.schema_id == schema_id, Table.deleted_at.is_(None))
    count_stmt = select(func.count()).select_from(Table).where(Table.schema_id == schema_id, Table.deleted_at.is_(None))
    if q:
        like_q = f"%{q}%"
        stmt = stmt.where(Table.name.ilike(like_q) | Table.description.ilike(like_q))
        count_stmt = count_stmt.where(Table.name.ilike(like_q) | Table.description.ilike(like_q))
    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(stmt.offset((page - 1) * size).limit(size))).scalars().all()
    return PaginatedTables(total=total, page=page, size=size, items=list(items))


@router.get("/tables/{table_id}", response_model=TableOut)
async def get_table(table_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    row = (await db.execute(select(Table).where(Table.id == table_id, Table.deleted_at.is_(None)))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Table not found")
    return row


@router.patch("/tables/{table_id}", response_model=TableOut)
async def patch_table(
    table_id: uuid.UUID, patch: TablePatch,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    row = (await db.execute(select(Table).where(Table.id == table_id, Table.deleted_at.is_(None)))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Table not found")
    changes = {k: v for k, v in patch.model_dump(exclude_unset=True).items() if k in ALLOWED_TABLE_PATCH}
    if "description" in changes and changes["description"]:
        changes["description"] = nh3.clean(changes["description"])
    old_data = {"description": row.description, "tags": row.tags, "sme_name": row.sme_name, "sme_email": row.sme_email}
    for field, value in changes.items():
        setattr(row, field, value)
    await log_action(db, "table", str(table_id), "update", current_user.id, old_data, changes)
    await db.commit()
    await db.refresh(row)
    sync_table(row)
    return row


# ─── Columns ──────────────────────────────────────────────────────────────────

@router.get("/tables/{table_id}/columns", response_model=PaginatedColumns)
async def list_columns(
    table_id: uuid.UUID, page: int = Query(1, ge=1), size: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    total = (await db.execute(select(func.count()).select_from(Column).where(Column.table_id == table_id, Column.deleted_at.is_(None)))).scalar_one()
    items = (await db.execute(select(Column).where(Column.table_id == table_id, Column.deleted_at.is_(None)).offset((page - 1) * size).limit(size))).scalars().all()
    return PaginatedColumns(total=total, page=page, size=size, items=list(items))


@router.get("/columns/{column_id}", response_model=ColumnOut)
async def get_column(column_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    row = (await db.execute(select(Column).where(Column.id == column_id, Column.deleted_at.is_(None)))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return row


@router.patch("/columns/{column_id}", response_model=ColumnOut)
async def patch_column(
    column_id: uuid.UUID, patch: ColumnPatch,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    row = (await db.execute(select(Column).where(Column.id == column_id, Column.deleted_at.is_(None)))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Column not found")
    changes = {k: v for k, v in patch.model_dump(exclude_unset=True).items() if k in ALLOWED_COLUMN_PATCH}
    if "description" in changes and changes["description"]:
        changes["description"] = nh3.clean(changes["description"])
    old_data = {"description": row.description, "tags": row.tags}
    for field, value in changes.items():
        setattr(row, field, value)
    await log_action(db, "column", str(column_id), "update", current_user.id, old_data, changes)
    await db.commit()
    await db.refresh(row)
    sync_column(row)
    return row
