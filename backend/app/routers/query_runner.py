"""Execute read-only SQL queries against connected databases."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/query-runner", tags=["query-runner"])


class QueryRunRequest(BaseModel):
    sql: str
    max_rows: int = 100


class QueryRunResult(BaseModel):
    columns: list[str]
    rows: list[list]
    row_count: int
    truncated: bool


@router.post("/execute", response_model=QueryRunResult)
async def execute_query(
    payload: QueryRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sql_lower = payload.sql.strip().lower()
    if not sql_lower.startswith("select") and not sql_lower.startswith("with") and not sql_lower.startswith("explain"):
        raise HTTPException(status_code=400, detail="Only SELECT, WITH, and EXPLAIN statements are allowed")

    dangerous = {"insert ", "update ", "delete ", "drop ", "alter ", "create ", "truncate ", "grant ", "revoke "}
    for kw in dangerous:
        if kw in sql_lower:
            raise HTTPException(status_code=400, detail=f"Statement contains forbidden keyword: {kw.strip()}")

    max_rows = min(payload.max_rows, 1000)

    try:
        result = await db.execute(text(f"SET LOCAL statement_timeout = '10s'"))
        result = await db.execute(text("SET TRANSACTION READ ONLY"))
        result = await db.execute(text(payload.sql))
        columns = list(result.keys()) if result.returns_rows else []
        if result.returns_rows:
            all_rows = result.fetchmany(max_rows + 1)
            truncated = len(all_rows) > max_rows
            rows = [list(r) for r in all_rows[:max_rows]]
        else:
            rows = []
            truncated = False
        await db.rollback()
        return QueryRunResult(columns=columns, rows=rows, row_count=len(rows), truncated=truncated)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)[:500])
