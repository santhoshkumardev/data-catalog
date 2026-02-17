"""
Integration tests for all PATCH/mutating endpoints across:
  - Database (PATCH description/tags)
  - Schema   (PATCH description/tags)
  - Table    (PATCH description/tags/sme)
  - Column   (PATCH title/description)
  - Comments (GET / POST / DELETE)
  - Lineage  (POST edge / PUT annotation / DELETE edge)

Run with:
  pip install pytest pytest-asyncio
  pytest backend/tests/ -v
"""
import httpx
import pytest

pytestmark = pytest.mark.asyncio

BASE_URL = "http://localhost:8001"


# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════════════════════

class TestPatchDatabase:
    async def test_patch_description(self, auth_headers, catalog_ids):
        db_id = catalog_ids["db_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/databases/{db_id}",
                json={"description": "Updated database description"},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["description"] == "Updated database description"

    async def test_patch_tags(self, auth_headers, catalog_ids):
        db_id = catalog_ids["db_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/databases/{db_id}",
                json={"tags": ["finance", "prod"]},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert set(resp.json()["tags"]) == {"finance", "prod"}

    async def test_patch_unknown_db_returns_404(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                "/api/v1/databases/00000000-0000-0000-0000-000000000000",
                json={"description": "ghost"},
                headers=auth_headers,
            )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMA
# ═══════════════════════════════════════════════════════════════════════════════

class TestPatchSchema:
    async def test_patch_description(self, auth_headers, catalog_ids):
        schema_id = catalog_ids["schema_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/schemas/{schema_id}",
                json={"description": "Schema description updated"},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["description"] == "Schema description updated"

    async def test_patch_tags(self, auth_headers, catalog_ids):
        schema_id = catalog_ids["schema_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/schemas/{schema_id}",
                json={"tags": ["raw", "ingested"]},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert set(resp.json()["tags"]) == {"raw", "ingested"}

    async def test_patch_unknown_schema_returns_404(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                "/api/v1/schemas/00000000-0000-0000-0000-000000000000",
                json={"description": "ghost"},
                headers=auth_headers,
            )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# TABLE
# ═══════════════════════════════════════════════════════════════════════════════

class TestPatchTable:
    async def test_patch_description(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/tables/{table_id}",
                json={"description": "Table description updated"},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["description"] == "Table description updated"

    async def test_patch_tags(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/tables/{table_id}",
                json={"tags": ["pii", "quarterly"]},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert set(resp.json()["tags"]) == {"pii", "quarterly"}

    async def test_patch_sme(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/tables/{table_id}",
                json={"sme_name": "Jane Doe", "sme_email": "jane@example.com"},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert body["sme_name"] == "Jane Doe"
        assert body["sme_email"] == "jane@example.com"

    async def test_patch_unknown_table_returns_404(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                "/api/v1/tables/00000000-0000-0000-0000-000000000000",
                json={"description": "ghost"},
                headers=auth_headers,
            )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# COLUMN
# ═══════════════════════════════════════════════════════════════════════════════

class TestPatchColumn:
    async def test_patch_title(self, auth_headers, catalog_ids):
        col_id = catalog_ids["col_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/columns/{col_id}",
                json={"title": "Primary Key"},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["title"] == "Primary Key"

    async def test_patch_description(self, auth_headers, catalog_ids):
        col_id = catalog_ids["col_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/columns/{col_id}",
                json={"description": "Auto-increment surrogate key"},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["description"] == "Auto-increment surrogate key"

    async def test_patch_tags(self, auth_headers, catalog_ids):
        col_id = catalog_ids["col_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/columns/{col_id}",
                json={"tags": ["pk", "indexed"]},
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert set(resp.json()["tags"]) == {"pk", "indexed"}

    async def test_patch_unknown_column_returns_404(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                "/api/v1/columns/00000000-0000-0000-0000-000000000000",
                json={"title": "ghost"},
                headers=auth_headers,
            )
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# COMMENTS  (entity_type="table", entity_id=<table_id>)
# ═══════════════════════════════════════════════════════════════════════════════

class TestComments:
    async def test_get_comments_empty(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.get(
                f"/api/v1/comments/table/{table_id}",
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert isinstance(resp.json(), list)

    async def test_add_comment(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.post(
                f"/api/v1/comments/table/{table_id}",
                json={"body": "This is a test comment"},
                headers=auth_headers,
            )
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert body["body"] == "This is a test comment"
        assert body["entity_type"] == "table"
        assert body["entity_id"] == table_id
        # Store comment_id in catalog_ids for the delete test
        catalog_ids["comment_id"] = body["id"]

    async def test_get_comments_after_add(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.get(
                f"/api/v1/comments/table/{table_id}",
                headers=auth_headers,
            )
        assert resp.status_code == 200
        comments = resp.json()
        assert any(c["body"] == "This is a test comment" for c in comments)

    async def test_delete_comment(self, auth_headers, catalog_ids):
        comment_id = catalog_ids.get("comment_id")
        if not comment_id:
            pytest.skip("comment_id not set — test_add_comment must run first")
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.delete(
                f"/api/v1/comments/{comment_id}",
                headers=auth_headers,
            )
        assert resp.status_code == 204, f"Expected 204, got {resp.status_code}: {resp.text}"

    async def test_comments_on_column(self, auth_headers, catalog_ids):
        col_id = catalog_ids["col_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            post_resp = await client.post(
                f"/api/v1/comments/column/{col_id}",
                json={"body": "Column-level comment"},
                headers=auth_headers,
            )
            assert post_resp.status_code == 201, f"Expected 201, got {post_resp.status_code}: {post_resp.text}"
            comment_id = post_resp.json()["id"]

            get_resp = await client.get(
                f"/api/v1/comments/column/{col_id}",
                headers=auth_headers,
            )
            assert get_resp.status_code == 200
            assert any(c["id"] == comment_id for c in get_resp.json())

            del_resp = await client.delete(f"/api/v1/comments/{comment_id}", headers=auth_headers)
            assert del_resp.status_code == 204


# ═══════════════════════════════════════════════════════════════════════════════
# LINEAGE
# ═══════════════════════════════════════════════════════════════════════════════

class TestLineage:
    async def test_create_lineage_edge(self, auth_headers, catalog_ids):
        db_name = catalog_ids["db_name"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.post(
                "/api/v1/lineage",
                json={
                    "source_db_name": db_name,
                    "source_table_name": "upstream_source",
                    "target_db_name": db_name,
                    "target_table_name": "test_catalog_table",
                },
                headers=auth_headers,
            )
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert body["source_table_name"] == "upstream_source"
        assert body["target_table_name"] == "test_catalog_table"
        catalog_ids["edge_id"] = body["id"]

    async def test_get_table_lineage(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.get(
                f"/api/v1/tables/{table_id}/lineage",
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert "upstream" in body
        assert "downstream" in body

    async def test_update_edge_annotation(self, auth_headers, catalog_ids):
        edge_id = catalog_ids.get("edge_id")
        if not edge_id:
            pytest.skip("edge_id not set — test_create_lineage_edge must run first")
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.put(
                f"/api/v1/lineage/{edge_id}/annotation",
                json={
                    "integration_description": "ETL pipeline from upstream_source",
                    "integration_method": "batch",
                    "integration_schedule": "daily",
                    "integration_notes": "Runs at 2 AM UTC",
                },
                headers=auth_headers,
            )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert body["integration_description"] == "ETL pipeline from upstream_source"
        assert body["integration_method"] == "batch"

    async def test_get_edge_annotation(self, auth_headers, catalog_ids):
        edge_id = catalog_ids.get("edge_id")
        if not edge_id:
            pytest.skip("edge_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.get(
                f"/api/v1/lineage/{edge_id}/annotation",
                headers=auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["integration_schedule"] == "daily"

    async def test_delete_lineage_edge(self, auth_headers, catalog_ids):
        edge_id = catalog_ids.get("edge_id")
        if not edge_id:
            pytest.skip("edge_id not set — test_create_lineage_edge must run first")
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.delete(
                f"/api/v1/lineage/{edge_id}",
                headers=auth_headers,
            )
        assert resp.status_code == 204, f"Expected 204, got {resp.status_code}: {resp.text}"

    async def test_create_duplicate_edge_returns_409(self, auth_headers, catalog_ids):
        db_name = catalog_ids["db_name"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            # First creation
            await client.post(
                "/api/v1/lineage",
                json={
                    "source_db_name": db_name,
                    "source_table_name": "dup_src",
                    "target_db_name": db_name,
                    "target_table_name": "dup_tgt",
                },
                headers=auth_headers,
            )
            # Duplicate
            resp = await client.post(
                "/api/v1/lineage",
                json={
                    "source_db_name": db_name,
                    "source_table_name": "dup_src",
                    "target_db_name": db_name,
                    "target_table_name": "dup_tgt",
                },
                headers=auth_headers,
            )
        assert resp.status_code == 409


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH / PERMISSION CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

class TestPermissions:
    async def test_patch_requires_auth(self, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            resp = await client.patch(
                f"/api/v1/tables/{table_id}",
                json={"description": "no auth"},
            )
        assert resp.status_code == 403

    async def test_viewer_cannot_patch(self, catalog_ids):
        """Viewer role must get 403 on any PATCH."""
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            login = await client.post("/auth/login", json={
                "email": "viewer@demo.com",
                "password": "viewer123",
            })
            if login.status_code != 200:
                pytest.skip("viewer@demo.com not found — run create_demo_users.py")
            viewer_token = login.json()["access_token"]

            resp = await client.patch(
                f"/api/v1/tables/{catalog_ids['table_id']}",
                json={"description": "viewer attempt"},
                headers={"Authorization": f"Bearer {viewer_token}"},
            )
        assert resp.status_code == 403
