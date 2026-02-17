"""
Shared fixtures for integration tests.

Requires the Docker stack to be running (docker compose up -d).
  - API:      http://localhost:8001
  - Postgres: localhost:5433

Demo steward user must exist. If not, run first:
  docker compose exec backend python create_demo_users.py
"""
import asyncio
import uuid

import asyncpg
import httpx
import pytest

BASE_URL = "http://localhost:8001"
INGEST_API_KEY = "dev-ingest-key"
STEWARD_EMAIL = "steward@demo.com"
STEWARD_PASSWORD = "steward123"
DB_DSN = "postgresql://catalog:catalogpass@localhost:5433/datacatalog"

# A unique tag used to identify all test-created entities for safe cleanup
TEST_TAG = "pytest-fixture"


# ── Event loop (session-scoped) ───────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── Steward JWT token ─────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
async def steward_token():
    """Login as the demo steward and return the Bearer token."""
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        resp = await client.post("/auth/login", json={
            "email": STEWARD_EMAIL,
            "password": STEWARD_PASSWORD,
        })
    assert resp.status_code == 200, (
        f"Login failed ({resp.status_code}). "
        "Run: docker compose exec backend python create_demo_users.py"
    )
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(steward_token):
    return {"Authorization": f"Bearer {steward_token}"}


# ── Catalog hierarchy (session-scoped, cleaned up after all tests) ────────────

@pytest.fixture(scope="session")
async def catalog_ids():
    """
    Create a full test hierarchy via the ingest API:
        test-catalog-db  →  test_catalog_schema  →  test_catalog_table
                              └─ columns: id (int, PK), name (varchar)
    Returns a dict with all IDs. Cleans up via asyncpg after the session.
    """
    db_name = f"test-catalog-db-{uuid.uuid4().hex[:8]}"

    # ── Create via ingest endpoint ────────────────────────────────────────────
    payload = {
        "database": {"name": db_name, "db_type": "postgresql"},
        "schemas": [
            {
                "name": "test_catalog_schema",
                "tables": [
                    {
                        "name": "test_catalog_table",
                        "columns": [
                            {"name": "id",   "data_type": "integer",      "is_primary_key": True, "is_nullable": False},
                            {"name": "name", "data_type": "varchar(255)", "is_nullable": True},
                        ],
                    }
                ],
            }
        ],
    }
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        resp = await client.post(
            "/api/v1/ingest/batch",
            json=payload,
            headers={"X-API-Key": INGEST_API_KEY},
        )
    assert resp.status_code == 200, f"Ingest failed: {resp.text}"
    ingest_result = resp.json()
    db_id = ingest_result["database_id"]

    # ── Fetch generated IDs from the catalog API ──────────────────────────────
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # Get token for read access
        login = await client.post("/auth/login", json={"email": STEWARD_EMAIL, "password": STEWARD_PASSWORD})
        token = login.json()["access_token"]
        hdrs = {"Authorization": f"Bearer {token}"}

        schemas_resp = await client.get(f"/api/v1/databases/{db_id}/schemas", headers=hdrs)
        schema_id = schemas_resp.json()["items"][0]["id"]

        tables_resp = await client.get(f"/api/v1/schemas/{schema_id}/tables", headers=hdrs)
        table_id = tables_resp.json()["items"][0]["id"]

        cols_resp = await client.get(f"/api/v1/tables/{table_id}/columns", headers=hdrs)
        col_id = cols_resp.json()["items"][0]["id"]

    ids = {
        "db_id": db_id,
        "db_name": db_name,
        "schema_id": schema_id,
        "table_id": table_id,
        "col_id": col_id,
    }

    yield ids

    # ── Teardown: delete test data directly from DB ───────────────────────────
    conn = await asyncpg.connect(DB_DSN)
    try:
        # Cascade deletes handle child rows (columns, tables, schemas)
        await conn.execute("DELETE FROM db_connections WHERE id = $1", uuid.UUID(db_id))
    finally:
        await conn.close()
