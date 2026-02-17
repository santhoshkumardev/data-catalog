import logging
from functools import partial

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.models.catalog import Article, Column, DbConnection, Query, Schema, Table
from app.models.glossary import GlossaryTerm
from app.search_engine import delete_document, index_document, index_documents

logger = logging.getLogger(__name__)


def sync_database(db_conn) -> None:
    index_document("databases", {
        "id": str(db_conn.id),
        "name": db_conn.name,
        "description": db_conn.description or "",
        "tags": db_conn.tags or [],
        "db_type": db_conn.db_type,
        "breadcrumb": [db_conn.name],
    })


def sync_schema(schema, *, db_name: str) -> None:
    index_document("schemas", {
        "id": str(schema.id),
        "name": schema.name,
        "description": schema.description or "",
        "tags": schema.tags or [],
        "connection_id": str(schema.connection_id),
        "db_name": db_name,
        "breadcrumb": [db_name, schema.name],
    })


def sync_table(table, *, db_name: str, schema_name: str, connection_id: str = "") -> None:
    index_document("tables", {
        "id": str(table.id),
        "name": table.name,
        "description": table.description or "",
        "tags": table.tags or [],
        "sme_name": table.sme_name or "",
        "object_type": table.object_type or "table",
        "schema_id": str(table.schema_id),
        "connection_id": connection_id,
        "db_name": db_name,
        "schema_name": schema_name,
        "breadcrumb": [db_name, schema_name, table.name],
    })


def sync_column(col, *, db_name: str, schema_name: str, table_name: str, connection_id: str = "", schema_id: str = "") -> None:
    index_document("columns", {
        "id": str(col.id),
        "name": col.name,
        "description": col.description or "",
        "data_type": col.data_type,
        "tags": col.tags or [],
        "table_id": str(col.table_id),
        "schema_id": schema_id,
        "connection_id": connection_id,
        "db_name": db_name,
        "schema_name": schema_name,
        "table_name": table_name,
        "breadcrumb": [db_name, schema_name, table_name],
    })


def sync_query(q) -> None:
    index_document("queries", {
        "id": str(q.id),
        "name": q.name,
        "description": q.description or "",
        "sme_name": q.sme_name or "",
        "sql_text": q.sql_text or "",
        "connection_id": str(q.connection_id) if q.connection_id else "",
        "breadcrumb": [q.name],
    })


def sync_article(a) -> None:
    index_document("articles", {
        "id": str(a.id),
        "title": a.title,
        "name": a.title,
        "description": a.description or "",
        "sme_name": a.sme_name or "",
        "body": a.body or "",
        "tags": a.tags or [],
        "breadcrumb": [a.title],
    })


def sync_glossary_term(term) -> None:
    index_document("glossary", {
        "id": str(term.id),
        "name": term.name,
        "definition": term.definition or "",
        "tags": term.tags or [],
        "status": term.status,
        "breadcrumb": [term.name],
    })


async def sync_database_async(db_conn) -> None:
    await run_in_threadpool(sync_database, db_conn)


async def sync_schema_async(schema, *, db_name: str) -> None:
    await run_in_threadpool(partial(sync_schema, schema, db_name=db_name))


async def sync_table_async(table, *, db_name: str, schema_name: str, connection_id: str = "") -> None:
    await run_in_threadpool(partial(sync_table, table, db_name=db_name, schema_name=schema_name, connection_id=connection_id))


async def sync_column_async(col, *, db_name: str, schema_name: str, table_name: str, connection_id: str = "", schema_id: str = "") -> None:
    await run_in_threadpool(partial(sync_column, col, db_name=db_name, schema_name=schema_name, table_name=table_name, connection_id=connection_id, schema_id=schema_id))


async def sync_query_async(q) -> None:
    await run_in_threadpool(sync_query, q)


async def sync_article_async(a) -> None:
    await run_in_threadpool(sync_article, a)


async def sync_glossary_term_async(term) -> None:
    await run_in_threadpool(sync_glossary_term, term)


def remove_document(index_name: str, doc_id: str) -> None:
    try:
        delete_document(index_name, doc_id)
    except Exception:
        pass


async def reindex_all(db: AsyncSession) -> dict[str, int]:
    """Reload all entities from DB and bulk-index them into Meilisearch."""
    counts: dict[str, int] = {}

    # Databases
    dbs = (await db.execute(
        select(DbConnection).where(DbConnection.deleted_at.is_(None))
    )).scalars().all()
    db_docs = []
    for d in dbs:
        db_docs.append({
            "id": str(d.id),
            "name": d.name,
            "description": d.description or "",
            "tags": d.tags or [],
            "db_type": d.db_type,
            "breadcrumb": [d.name],
        })
    index_documents("databases", db_docs)
    counts["databases"] = len(db_docs)

    # Build a lookup for db names
    db_name_map = {d.id: d.name for d in dbs}

    # Schemas
    schemas = (await db.execute(
        select(Schema).where(Schema.deleted_at.is_(None))
    )).scalars().all()
    schema_docs = []
    for s in schemas:
        d_name = db_name_map.get(s.connection_id, "")
        schema_docs.append({
            "id": str(s.id),
            "name": s.name,
            "description": s.description or "",
            "tags": s.tags or [],
            "connection_id": str(s.connection_id),
            "db_name": d_name,
            "breadcrumb": [d_name, s.name],
        })
    index_documents("schemas", schema_docs)
    counts["schemas"] = len(schema_docs)

    # Build schema lookups
    schema_info_map = {s.id: (db_name_map.get(s.connection_id, ""), s.name) for s in schemas}
    schema_conn_map = {s.id: str(s.connection_id) for s in schemas}

    # Tables
    tables = (await db.execute(
        select(Table).where(Table.deleted_at.is_(None))
    )).scalars().all()
    table_docs = []
    for t in tables:
        d_name, s_name = schema_info_map.get(t.schema_id, ("", ""))
        conn_id = schema_conn_map.get(t.schema_id, "")
        table_docs.append({
            "id": str(t.id),
            "name": t.name,
            "description": t.description or "",
            "tags": t.tags or [],
            "sme_name": t.sme_name or "",
            "object_type": t.object_type or "table",
            "schema_id": str(t.schema_id),
            "connection_id": conn_id,
            "db_name": d_name,
            "schema_name": s_name,
            "breadcrumb": [d_name, s_name, t.name],
        })
    index_documents("tables", table_docs)
    counts["tables"] = len(table_docs)

    # Build table lookup
    table_info_map = {}
    for t in tables:
        d_name, s_name = schema_info_map.get(t.schema_id, ("", ""))
        conn_id = schema_conn_map.get(t.schema_id, "")
        table_info_map[t.id] = (d_name, s_name, t.name, conn_id, str(t.schema_id))

    # Columns
    columns = (await db.execute(
        select(Column).where(Column.deleted_at.is_(None))
    )).scalars().all()
    col_docs = []
    for c in columns:
        d_name, s_name, t_name, conn_id, s_id = table_info_map.get(c.table_id, ("", "", "", "", ""))
        col_docs.append({
            "id": str(c.id),
            "name": c.name,
            "description": c.description or "",
            "data_type": c.data_type,
            "tags": c.tags or [],
            "table_id": str(c.table_id),
            "schema_id": s_id,
            "connection_id": conn_id,
            "db_name": d_name,
            "schema_name": s_name,
            "table_name": t_name,
            "breadcrumb": [d_name, s_name, t_name],
        })
    index_documents("columns", col_docs)
    counts["columns"] = len(col_docs)

    # Queries
    queries = (await db.execute(
        select(Query).where(Query.deleted_at.is_(None))
    )).scalars().all()
    q_docs = []
    for q in queries:
        q_docs.append({
            "id": str(q.id),
            "name": q.name,
            "description": q.description or "",
            "sme_name": q.sme_name or "",
            "sql_text": q.sql_text or "",
            "connection_id": str(q.connection_id) if q.connection_id else "",
            "breadcrumb": [q.name],
        })
    index_documents("queries", q_docs)
    counts["queries"] = len(q_docs)

    # Articles
    articles = (await db.execute(
        select(Article).where(Article.deleted_at.is_(None))
    )).scalars().all()
    a_docs = []
    for a in articles:
        a_docs.append({
            "id": str(a.id),
            "title": a.title,
            "name": a.title,
            "description": a.description or "",
            "sme_name": a.sme_name or "",
            "body": a.body or "",
            "tags": a.tags or [],
            "breadcrumb": [a.title],
        })
    index_documents("articles", a_docs)
    counts["articles"] = len(a_docs)

    # Glossary
    terms = (await db.execute(
        select(GlossaryTerm).where(GlossaryTerm.deleted_at.is_(None))
    )).scalars().all()
    g_docs = []
    for term in terms:
        g_docs.append({
            "id": str(term.id),
            "name": term.name,
            "definition": term.definition or "",
            "tags": term.tags or [],
            "status": term.status,
            "breadcrumb": [term.name],
        })
    index_documents("glossary", g_docs)
    counts["glossary"] = len(g_docs)

    logger.info("Reindex complete: %s", counts)
    return counts
