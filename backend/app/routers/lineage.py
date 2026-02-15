"""Lineage endpoints — read (JWT), write (steward), with BFS node-count cap."""
import uuid
from collections import deque

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_steward
from app.database import get_db
from app.models.catalog import DbConnection, Schema, Table, TableLineage
from app.models.user import User
from app.schemas.catalog import LineageEdgeCreate, LineageEdgeOut, LineageGraph, LineageNode, LineageTableSearchResult
from app.services.audit import log_action

router = APIRouter(prefix="/api/v1", tags=["lineage"])

MAX_BFS_NODES = 500


async def _resolve_table(table_id: uuid.UUID, db: AsyncSession) -> tuple[str, str]:
    result = await db.execute(
        select(DbConnection.name, Table.name)
        .join(Schema, Schema.connection_id == DbConnection.id)
        .join(Table, Table.schema_id == Schema.id)
        .where(Table.id == table_id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")
    return row[0], row[1]


async def _is_catalog_table(db_name: str, table_name: str, db: AsyncSession) -> tuple[bool, uuid.UUID | None]:
    result = await db.execute(
        select(Table.id).join(Schema).join(DbConnection)
        .where(DbConnection.name == db_name, Table.name == table_name).limit(1)
    )
    tid = result.scalar_one_or_none()
    return (tid is not None), tid


async def _bfs(start_db: str, start_table: str, max_levels: int, db: AsyncSession, direction: str) -> list[LineageNode]:
    visited: set[tuple[str, str]] = {(start_db, start_table)}
    roots: list[LineageNode] = []
    queue: deque[tuple[str, str, list[LineageNode], int]] = deque()
    queue.append((start_db, start_table, roots, 0))
    node_count = 0

    while queue:
        cur_db, cur_table, parent_list, depth = queue.popleft()
        if depth >= max_levels or node_count >= MAX_BFS_NODES:
            continue

        if direction == "upstream":
            result = await db.execute(
                select(TableLineage).where(TableLineage.target_db_name == cur_db, TableLineage.target_table_name == cur_table, TableLineage.deleted_at.is_(None))
            )
        else:
            result = await db.execute(
                select(TableLineage).where(TableLineage.source_db_name == cur_db, TableLineage.source_table_name == cur_table, TableLineage.deleted_at.is_(None))
            )
        edges = result.scalars().all()

        for edge in edges:
            if node_count >= MAX_BFS_NODES:
                break
            if direction == "upstream":
                n_db, n_table = edge.source_db_name, edge.source_table_name
            else:
                n_db, n_table = edge.target_db_name, edge.target_table_name
            is_cat, tid = await _is_catalog_table(n_db, n_table, db)
            node = LineageNode(db_name=n_db, table_name=n_table, is_catalog_table=is_cat, table_id=tid, edge_id=edge.id)
            parent_list.append(node)
            node_count += 1
            key = (n_db, n_table)
            if key not in visited:
                visited.add(key)
                queue.append((n_db, n_table, node.children, depth + 1))

    return roots


def _collect_leaves(nodes: list[LineageNode]) -> list[LineageNode]:
    leaves = []
    for node in nodes:
        if not node.children:
            leaves.append(node)
        else:
            leaves.extend(_collect_leaves(node.children))
    return leaves


async def _mark_has_more(all_nodes: list[LineageNode], db: AsyncSession) -> None:
    leaves = _collect_leaves(all_nodes)
    if not leaves:
        return
    pairs = list({(n.db_name, n.table_name) for n in leaves})
    up_result = await db.execute(
        select(TableLineage.target_db_name, TableLineage.target_table_name)
        .where(tuple_(TableLineage.target_db_name, TableLineage.target_table_name).in_(pairs), TableLineage.deleted_at.is_(None)).distinct()
    )
    has_upstream = {(r[0], r[1]) for r in up_result}
    down_result = await db.execute(
        select(TableLineage.source_db_name, TableLineage.source_table_name)
        .where(tuple_(TableLineage.source_db_name, TableLineage.source_table_name).in_(pairs), TableLineage.deleted_at.is_(None)).distinct()
    )
    has_downstream = {(r[0], r[1]) for r in down_result}
    for node in leaves:
        pair = (node.db_name, node.table_name)
        node.has_more_upstream = pair in has_upstream
        node.has_more_downstream = pair in has_downstream


@router.get("/lineage/search-tables", response_model=list[LineageTableSearchResult])
async def search_tables_for_lineage(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DbConnection.name, Table.name, Table.id)
        .join(Schema, Schema.connection_id == DbConnection.id)
        .join(Table, Table.schema_id == Schema.id)
        .where(Table.name.ilike(f"%{q}%"))
        .order_by(Table.name)
        .limit(limit)
    )
    return [
        LineageTableSearchResult(db_name=row[0], table_name=row[1], table_id=row[2])
        for row in result.all()
    ]


@router.get("/lineage/expand", response_model=list[LineageNode])
async def expand_lineage_node(
    db_name: str = Query(...),
    table_name: str = Query(...),
    direction: str = Query(..., pattern="^(upstream|downstream)$"),
    levels: int = Query(1, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    nodes = await _bfs(db_name, table_name, levels, db, direction)
    await _mark_has_more(nodes, db)
    return nodes


@router.get("/tables/{table_id}/lineage", response_model=LineageGraph)
async def get_table_lineage(
    table_id: uuid.UUID, levels: int = Query(1, ge=1, le=5),
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    db_name, table_name = await _resolve_table(table_id, db)
    upstream = await _bfs(db_name, table_name, levels, db, "upstream")
    downstream = await _bfs(db_name, table_name, levels, db, "downstream")
    await _mark_has_more(upstream + downstream, db)
    return LineageGraph(upstream=upstream, downstream=downstream, current_db=db_name, current_table=table_name)


@router.post("/lineage", response_model=LineageEdgeOut, status_code=status.HTTP_201_CREATED)
async def create_lineage_edge(
    data: LineageEdgeCreate, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_steward),
):
    result = await db.execute(
        select(TableLineage).where(
            TableLineage.source_db_name == data.source_db_name, TableLineage.source_table_name == data.source_table_name,
            TableLineage.target_db_name == data.target_db_name, TableLineage.target_table_name == data.target_table_name,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Edge already exists")
    edge = TableLineage(
        id=uuid.uuid4(), source_db_name=data.source_db_name, source_table_name=data.source_table_name,
        target_db_name=data.target_db_name, target_table_name=data.target_table_name, created_by=current_user.id,
    )
    db.add(edge)
    await log_action(db, "lineage", str(edge.id), "create", current_user.id)
    await db.commit()
    await db.refresh(edge)
    return edge


@router.delete("/lineage/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lineage_edge(
    edge_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_steward),
):
    result = await db.execute(select(TableLineage).where(TableLineage.id == edge_id))
    edge = result.scalar_one_or_none()
    if edge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Edge not found")
    await db.delete(edge)
    await log_action(db, "lineage", str(edge_id), "delete", current_user.id)
    await db.commit()
