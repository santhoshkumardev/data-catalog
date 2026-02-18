"""Metadata ingestion endpoints — protected by API key."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_ingest_api_key
from app.database import get_db
from app.models.catalog import Column, DbConnection, Schema, Table, TableLineage
from app.models.governance import ResourcePermission
from app.models.user import User
from app.schemas.catalog import IngestBatchPayload, IngestBatchResult, LineageEdgeCreate
from app.services.search_sync import sync_column_async, sync_database_async, sync_schema_async, sync_table_async

router = APIRouter(prefix="/api/v1/ingest", tags=["ingest"], dependencies=[Depends(require_ingest_api_key)])

MAX_SCHEMAS = 100
MAX_TABLES_PER_SCHEMA = 500
MAX_COLUMNS_PER_TABLE = 1000


async def _assign_stewards(db: AsyncSession, entity_type: str, entity_id: str, emails: list[str]):
    """Assign stewards by email. Skips unknown emails and duplicates silently."""
    for email in emails:
        email = email.strip()
        if not email:
            continue
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is None:
            continue
        existing = (await db.execute(
            select(ResourcePermission).where(
                ResourcePermission.user_id == user.id,
                ResourcePermission.entity_type == entity_type,
                ResourcePermission.entity_id == str(entity_id),
                ResourcePermission.role == "steward",
            )
        )).scalar_one_or_none()
        if existing:
            continue
        db.add(ResourcePermission(
            user_id=user.id, entity_type=entity_type,
            entity_id=str(entity_id), role="steward",
        ))


@router.post("/batch", response_model=IngestBatchResult)
async def ingest_batch(payload: IngestBatchPayload, db: AsyncSession = Depends(get_db)):
    if len(payload.schemas) > MAX_SCHEMAS:
        raise HTTPException(status_code=400, detail=f"Max {MAX_SCHEMAS} schemas per batch")

    result = await db.execute(select(DbConnection).where(DbConnection.name == payload.database.name))
    db_conn = result.scalar_one_or_none()
    if db_conn is None:
        db_conn = DbConnection(id=uuid.uuid4(), **payload.database.model_dump())
        db.add(db_conn)
    else:
        db_conn.db_type = payload.database.db_type
        db_conn.deleted_at = None

    await db.flush()

    schemas_upserted = tables_upserted = columns_upserted = 0

    for schema_payload in payload.schemas:
        if len(schema_payload.tables) > MAX_TABLES_PER_SCHEMA:
            raise HTTPException(status_code=400, detail=f"Max {MAX_TABLES_PER_SCHEMA} tables per schema")
        result = await db.execute(select(Schema).where(Schema.connection_id == db_conn.id, Schema.name == schema_payload.name))
        schema = result.scalar_one_or_none()
        if schema is None:
            schema = Schema(
                id=uuid.uuid4(), connection_id=db_conn.id, name=schema_payload.name,
                title=schema_payload.title, description=schema_payload.description,
            )
            db.add(schema)
        else:
            if schema_payload.title is not None:
                schema.title = schema_payload.title
            if schema_payload.description is not None:
                schema.description = schema_payload.description
            schema.deleted_at = None
        schemas_upserted += 1
        await db.flush()

        if schema_payload.steward_emails:
            await _assign_stewards(db, "schema", schema.id, schema_payload.steward_emails)

        for table_payload in schema_payload.tables:
            if len(table_payload.columns) > MAX_COLUMNS_PER_TABLE:
                raise HTTPException(status_code=400, detail=f"Max {MAX_COLUMNS_PER_TABLE} columns per table")
            result = await db.execute(select(Table).where(Table.schema_id == schema.id, Table.name == table_payload.name))
            table = result.scalar_one_or_none()
            if table is None:
                table = Table(
                    id=uuid.uuid4(), schema_id=schema.id, name=table_payload.name,
                    title=table_payload.title, description=table_payload.description,
                    row_count=table_payload.row_count, object_type=table_payload.object_type,
                    view_definition=table_payload.view_definition,
                )
                db.add(table)
            else:
                if table_payload.title is not None:
                    table.title = table_payload.title
                if table_payload.description is not None:
                    table.description = table_payload.description
                if table_payload.row_count is not None:
                    table.row_count = table_payload.row_count
                table.object_type = table_payload.object_type
                table.view_definition = table_payload.view_definition
                table.deleted_at = None
            tables_upserted += 1
            await db.flush()

            if table_payload.steward_emails:
                await _assign_stewards(db, "table", table.id, table_payload.steward_emails)

            existing_cols_result = await db.execute(select(Column).where(Column.table_id == table.id))
            existing_cols = {c.name: c for c in existing_cols_result.scalars().all()}

            for col_payload in table_payload.columns:
                if col_payload.name in existing_cols:
                    col = existing_cols[col_payload.name]
                    col.data_type = col_payload.data_type
                    col.is_nullable = col_payload.is_nullable
                    col.is_primary_key = col_payload.is_primary_key
                    if col_payload.title is not None:
                        col.title = col_payload.title
                    if col_payload.description is not None:
                        col.description = col_payload.description
                    col.deleted_at = None
                else:
                    col = Column(
                        id=uuid.uuid4(), table_id=table.id, name=col_payload.name,
                        data_type=col_payload.data_type, is_nullable=col_payload.is_nullable,
                        is_primary_key=col_payload.is_primary_key,
                        title=col_payload.title, description=col_payload.description,
                    )
                    db.add(col)
                columns_upserted += 1

    # Mark missing objects as deleted if requested
    if payload.mark_missing_as_deleted:
        now = datetime.now(timezone.utc)
        ingested_schema_names = {sp.name for sp in payload.schemas}

        # Find schemas under this database that were NOT in the payload
        all_schemas = (await db.execute(
            select(Schema).where(Schema.connection_id == db_conn.id, Schema.deleted_at.is_(None))
        )).scalars().all()
        for s in all_schemas:
            if s.name not in ingested_schema_names:
                s.deleted_at = now
                # Also mark all tables/columns under this schema as deleted
                all_tables = (await db.execute(
                    select(Table).where(Table.schema_id == s.id, Table.deleted_at.is_(None))
                )).scalars().all()
                for t in all_tables:
                    t.deleted_at = now
                    all_cols = (await db.execute(
                        select(Column).where(Column.table_id == t.id, Column.deleted_at.is_(None))
                    )).scalars().all()
                    for c in all_cols:
                        c.deleted_at = now

        # For each ingested schema, mark missing tables
        for schema_payload in payload.schemas:
            schema_row = (await db.execute(
                select(Schema).where(Schema.connection_id == db_conn.id, Schema.name == schema_payload.name)
            )).scalar_one_or_none()
            if schema_row is None:
                continue
            ingested_table_names = {tp.name for tp in schema_payload.tables}
            all_tables = (await db.execute(
                select(Table).where(Table.schema_id == schema_row.id, Table.deleted_at.is_(None))
            )).scalars().all()
            for t in all_tables:
                if t.name not in ingested_table_names:
                    t.deleted_at = now
                    all_cols = (await db.execute(
                        select(Column).where(Column.table_id == t.id, Column.deleted_at.is_(None))
                    )).scalars().all()
                    for c in all_cols:
                        c.deleted_at = now

            # For each ingested table, mark missing columns
            for table_payload in schema_payload.tables:
                table_row = (await db.execute(
                    select(Table).where(Table.schema_id == schema_row.id, Table.name == table_payload.name)
                )).scalar_one_or_none()
                if table_row is None:
                    continue
                ingested_col_names = {cp.name for cp in table_payload.columns}
                all_cols = (await db.execute(
                    select(Column).where(Column.table_id == table_row.id, Column.deleted_at.is_(None))
                )).scalars().all()
                for c in all_cols:
                    if c.name not in ingested_col_names:
                        c.deleted_at = now

    await db.commit()

    # Sync all ingested entities to Meilisearch
    try:
        await sync_database_async(db_conn)
        for schema_payload in payload.schemas:
            result = await db.execute(select(Schema).where(Schema.connection_id == db_conn.id, Schema.name == schema_payload.name))
            schema = result.scalar_one_or_none()
            if schema is None:
                continue
            await sync_schema_async(schema, db_name=db_conn.name)
            for table_payload in schema_payload.tables:
                result = await db.execute(select(Table).where(Table.schema_id == schema.id, Table.name == table_payload.name))
                table = result.scalar_one_or_none()
                if table is None:
                    continue
                await sync_table_async(table, db_name=db_conn.name, schema_name=schema.name, connection_id=str(db_conn.id))
                cols = (await db.execute(select(Column).where(Column.table_id == table.id))).scalars().all()
                for col in cols:
                    await sync_column_async(col, db_name=db_conn.name, schema_name=schema.name, table_name=table.name, connection_id=str(db_conn.id), schema_id=str(schema.id))
    except Exception:
        pass

    return IngestBatchResult(
        database_id=db_conn.id, schemas_upserted=schemas_upserted,
        tables_upserted=tables_upserted, columns_upserted=columns_upserted,
    )


@router.post("/lineage", status_code=200)
async def ingest_lineage(edges: list[LineageEdgeCreate], db: AsyncSession = Depends(get_db)):
    if not edges:
        return {"inserted": 0}
    if len(edges) > 1000:
        raise HTTPException(status_code=400, detail="Max 1000 edges per batch")
    rows = [
        {
            "id": uuid.uuid4(), "source_db_name": e.source_db_name,
            "source_table_name": e.source_table_name,
            "target_db_name": e.target_db_name, "target_table_name": e.target_table_name,
        }
        for e in edges
    ]
    stmt = pg_insert(TableLineage).values(rows).on_conflict_do_nothing(constraint="uq_lineage_edge")
    result = await db.execute(stmt)
    await db.commit()
    return {"inserted": result.rowcount}
