"""Data Catalog v2 — FastAPI application."""
import asyncio
import contextlib
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.database import AsyncSessionLocal
from app.middleware.logging import LoggingMiddleware, configure_logging
from app.middleware.rate_limit import limiter
from app.middleware.request_id import RequestIdMiddleware
from app.search_engine import init_indexes
from app.services.search_sync import reindex_all
from app.storage import ensure_bucket

logger = logging.getLogger(__name__)


async def _background_reindex():
    try:
        async with AsyncSessionLocal() as db:
            counts = await reindex_all(db)
            logger.info("Startup reindex complete: %s", counts)
    except Exception:
        logger.warning("Startup reindex failed", exc_info=True)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    try:
        await init_indexes()
    except Exception:
        pass  # Meilisearch may not be ready yet
    try:
        ensure_bucket()
    except Exception:
        pass  # MinIO may not be ready yet
    asyncio.create_task(_background_reindex())
    yield


app = FastAPI(title="Data Catalog v2", version="2.0.0", lifespan=lifespan)

# --- State / extensions ---
app.state.limiter = limiter

# --- Middleware (order matters: outermost first) ---
app.add_middleware(LoggingMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)

# --- Rate-limit error handler ---
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Routers ---
from app.routers import (  # noqa: E402
    admin,
    analytics,
    articles,
    auth,
    catalog,
    comments,
    favorites,
    glossary,
    governance,
    health,
    ingest,
    lineage,
    notifications,
    profiling,
    queries,
    query_runner,
    search,
    webhooks,
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(search.router)
app.include_router(queries.router)
app.include_router(articles.router)
app.include_router(lineage.router)
app.include_router(ingest.router)
app.include_router(admin.router)
app.include_router(glossary.router)
app.include_router(comments.router)
app.include_router(favorites.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(governance.router)
app.include_router(webhooks.router)
app.include_router(profiling.router)
app.include_router(query_runner.router)
