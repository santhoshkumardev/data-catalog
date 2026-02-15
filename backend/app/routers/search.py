"""Meilisearch-powered full-text search across all catalog entities."""
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.redis_client import cache_get, cache_set
from app.schemas.catalog import SearchResponse, SearchResult
from app.search_engine import multi_search, INDEXES

router = APIRouter(prefix="/api/v1", tags=["search"])

EntityType = Literal["all", "database", "schema", "table", "column", "query", "article", "glossary"]

INDEX_MAP = {
    "database": "databases",
    "schema": "schemas",
    "table": "tables",
    "column": "columns",
    "query": "queries",
    "article": "articles",
    "glossary": "glossary",
}

# Reverse map: index uid -> entity type (rstrip("s") fails for "queries" → "querie")
INDEX_TO_ENTITY = {v: k for k, v in INDEX_MAP.items()}


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1),
    type: EntityType = Query("all"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _: User = Depends(get_current_user),
):
    offset = (page - 1) * size

    if type == "all":
        target_indexes = INDEXES
    else:
        idx = INDEX_MAP.get(type)
        target_indexes = [idx] if idx else INDEXES

    try:
        result = multi_search(q, target_indexes, limit=size, offset=offset)
    except Exception:
        return SearchResponse(total=0, page=page, size=size, results=[])

    results = []
    total = 0
    for idx_result in result.get("results", []):
        index_uid = idx_result.get("indexUid", "")
        entity_type = INDEX_TO_ENTITY.get(index_uid, index_uid)
        estimated_total = idx_result.get("estimatedTotalHits", 0)
        total += estimated_total

        for hit in idx_result.get("hits", []):
            name = hit.get("name") or hit.get("title", "")
            # Derive parent_id based on entity type
            if entity_type == "column":
                parent_id = hit.get("table_id")
            elif entity_type == "table":
                parent_id = hit.get("schema_id")
            elif entity_type == "schema":
                parent_id = hit.get("connection_id")
            else:
                parent_id = hit.get("connection_id")
            results.append(SearchResult(
                id=hit.get("id", ""),
                entity_type=entity_type,
                name=name,
                description=hit.get("description") or hit.get("definition"),
                tags=hit.get("tags"),
                breadcrumb=hit.get("breadcrumb", [name]),
                rank=1.0,
                parent_id=parent_id,
                connection_id=hit.get("connection_id"),
                schema_id=hit.get("schema_id"),
            ))

    return SearchResponse(total=total, page=page, size=size, results=results)


@router.get("/stats")
async def stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cached = await cache_get("stats")
    if cached:
        return cached

    row = (await db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM db_connections WHERE deleted_at IS NULL) AS databases,
            (SELECT COUNT(*) FROM schemas WHERE deleted_at IS NULL) AS schemas,
            (SELECT COUNT(*) FROM tables WHERE deleted_at IS NULL) AS tables,
            (SELECT COUNT(*) FROM columns WHERE deleted_at IS NULL) AS columns,
            (SELECT COUNT(*) FROM queries WHERE deleted_at IS NULL) AS queries,
            (SELECT COUNT(*) FROM articles WHERE deleted_at IS NULL) AS articles,
            (SELECT COUNT(*) FROM glossary_terms WHERE deleted_at IS NULL) AS glossary_terms
    """))).mappings().one()

    result = dict(row)
    await cache_set("stats", result, ttl=60)
    return result
