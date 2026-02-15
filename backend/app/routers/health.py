"""Health and readiness endpoints."""
from fastapi import APIRouter
from sqlalchemy import text

from app.database import AsyncSessionLocal
from app.redis_client import get_redis
from app.search_engine import get_client

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/ready")
async def ready():
    checks = {}
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = str(e)

    try:
        r = await get_redis()
        await r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = str(e)

    try:
        client = get_client()
        client.health()
        checks["meilisearch"] = "ok"
    except Exception as e:
        checks["meilisearch"] = str(e)

    all_ok = all(v == "ok" for v in checks.values())
    return {"status": "ok" if all_ok else "degraded", "checks": checks}
