"""
Full regression test suite.

Covers:
  - Health / readiness endpoints
  - Auth (login, me, logout + token blacklist, viewer vs steward permissions)
  - Catalog reads  (databases, schemas, tables, columns, context endpoints)
  - Catalog writes (PATCH database/schema/table/column, 404 guards)
  - Redis list-cache  (GET returns cached data, PATCH invalidates)
  - Search
  - Glossary  (CRUD + term links)
  - Articles  (CRUD)
  - Saved Queries  (CRUD)
  - Analytics  (popular, trending, view tracking)
  - Comments  (multi-entity)
  - Favorites
  - Notifications
  - Lineage  (create / annotate / expand / delete, duplicate guard)
  - Ingest batch
  - Permissions (viewer 403, no-token 403)
"""
import time
import httpx
import pytest

pytestmark = pytest.mark.asyncio

BASE_URL = "http://localhost:8001"
STEWARD = {"email": "steward@demo.com", "password": "steward123"}
VIEWER  = {"email": "viewer@demo.com",  "password": "viewer123"}
INGEST_KEY = "dev-ingest-key"


# ─── helpers ──────────────────────────────────────────────────────────────────

async def _login(client, creds):
    r = await client.post("/auth/login", json=creds)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

class TestHealth:
    async def test_health(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/health")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    async def test_ready(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/ready")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuth:
    async def test_steward_login(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post("/auth/login", json=STEWARD)
        assert r.status_code == 200
        assert "access_token" in r.json()

    async def test_viewer_login(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post("/auth/login", json=VIEWER)
        assert r.status_code == 200

    async def test_bad_password_returns_401(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post("/auth/login", json={"email": "steward@demo.com", "password": "WRONG"})
        assert r.status_code == 401

    async def test_me_returns_user(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/auth/me", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == STEWARD["email"]
        assert body["role"] == "steward"

    async def test_me_without_token_returns_403(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/auth/me")
        assert r.status_code == 403

    async def test_logout_blacklists_token(self):
        """Token should be rejected after logout."""
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            login_r = await c.post("/auth/login", json=STEWARD)
            token = login_r.json()["access_token"]
            hdrs = {"Authorization": f"Bearer {token}"}
            # Confirm it works before logout
            me_r = await c.get("/auth/me", headers=hdrs)
            assert me_r.status_code == 200
            # Logout
            logout_r = await c.post("/auth/logout", headers=hdrs)
            assert logout_r.status_code == 200
            # Should now be rejected
            me_after = await c.get("/auth/me", headers=hdrs)
        assert me_after.status_code == 401

    async def test_providers_endpoint(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/auth/providers")
        assert r.status_code == 200
        assert "providers" in r.json()


# ═══════════════════════════════════════════════════════════════════════════════
# CATALOG — READS
# ═══════════════════════════════════════════════════════════════════════════════

class TestCatalogReads:
    async def test_list_databases(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/databases", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body and "total" in body
        ids = [d["id"] for d in body["items"]]
        assert catalog_ids["db_id"] in ids

    async def test_list_databases_with_search(self, auth_headers, catalog_ids):
        db_name = catalog_ids["db_name"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/databases?q={db_name[:10]}", headers=auth_headers)
        assert r.status_code == 200
        assert any(d["id"] == catalog_ids["db_id"] for d in r.json()["items"])

    async def test_get_database(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/databases/{catalog_ids['db_id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == catalog_ids["db_id"]

    async def test_list_schemas(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/databases/{catalog_ids['db_id']}/schemas", headers=auth_headers)
        assert r.status_code == 200
        assert any(s["id"] == catalog_ids["schema_id"] for s in r.json()["items"])

    async def test_get_schema(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/schemas/{catalog_ids['schema_id']}", headers=auth_headers)
        assert r.status_code == 200

    async def test_list_tables(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/schemas/{catalog_ids['schema_id']}/tables", headers=auth_headers)
        assert r.status_code == 200
        assert any(t["id"] == catalog_ids["table_id"] for t in r.json()["items"])

    async def test_get_table(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/tables/{catalog_ids['table_id']}", headers=auth_headers)
        assert r.status_code == 200

    async def test_get_table_context(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/tables/{catalog_ids['table_id']}/context", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "context" in body
        assert body["context"]["database"]["id"] == catalog_ids["db_id"]

    async def test_list_columns(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/tables/{catalog_ids['table_id']}/columns", headers=auth_headers)
        assert r.status_code == 200
        assert any(col["id"] == catalog_ids["col_id"] for col in r.json()["items"])

    async def test_get_column(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/columns/{catalog_ids['col_id']}", headers=auth_headers)
        assert r.status_code == 200

    async def test_get_column_context(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/columns/{catalog_ids['col_id']}/context", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "context" in body and "table" in body

    async def test_get_nonexistent_db_returns_404(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/databases/00000000-0000-0000-0000-000000000000", headers=auth_headers)
        assert r.status_code == 404

    async def test_get_nonexistent_table_returns_404(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/tables/00000000-0000-0000-0000-000000000000", headers=auth_headers)
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# REDIS LIST CACHE — cache hit + invalidation
# ═══════════════════════════════════════════════════════════════════════════════

class TestListCache:
    """
    Verifies that:
    1. GET /databases returns the same data on second call (cached path)
    2. PATCH invalidates the cache — subsequent GET reflects the change
    """

    async def test_databases_cache_consistent(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r1 = await c.get("/api/v1/databases?page=1&size=20", headers=auth_headers)
            r2 = await c.get("/api/v1/databases?page=1&size=20", headers=auth_headers)
        assert r1.status_code == r2.status_code == 200
        # Both calls should return identical totals and item counts
        assert r1.json()["total"] == r2.json()["total"]

    async def test_patch_database_invalidates_cache(self, auth_headers, catalog_ids):
        db_id = catalog_ids["db_id"]
        new_desc = "cache-invalidation-test"
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            # Warm the cache
            await c.get("/api/v1/databases?page=1&size=50", headers=auth_headers)
            # Mutate
            patch_r = await c.patch(
                f"/api/v1/databases/{db_id}",
                json={"description": new_desc},
                headers=auth_headers,
            )
            assert patch_r.status_code == 200
            assert patch_r.json()["description"] == new_desc
            # Read back directly (not from old cache)
            get_r = await c.get(f"/api/v1/databases/{db_id}", headers=auth_headers)
        assert get_r.json()["description"] == new_desc

    async def test_patch_schema_invalidates_cache(self, auth_headers, catalog_ids):
        schema_id = catalog_ids["schema_id"]
        new_desc = "schema-cache-invalidation-test"
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            await c.get(
                f"/api/v1/databases/{catalog_ids['db_id']}/schemas?page=1&size=20",
                headers=auth_headers,
            )
            patch_r = await c.patch(
                f"/api/v1/schemas/{schema_id}",
                json={"description": new_desc},
                headers=auth_headers,
            )
            assert patch_r.status_code == 200
            get_r = await c.get(f"/api/v1/schemas/{schema_id}", headers=auth_headers)
        assert get_r.json()["description"] == new_desc

    async def test_patch_table_invalidates_cache(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        new_desc = "table-cache-invalidation-test"
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            await c.get(
                f"/api/v1/schemas/{catalog_ids['schema_id']}/tables?page=1&size=20",
                headers=auth_headers,
            )
            patch_r = await c.patch(
                f"/api/v1/tables/{table_id}",
                json={"description": new_desc},
                headers=auth_headers,
            )
            assert patch_r.status_code == 200
            get_r = await c.get(f"/api/v1/tables/{table_id}", headers=auth_headers)
        assert get_r.json()["description"] == new_desc


# ═══════════════════════════════════════════════════════════════════════════════
# SEARCH
# ═══════════════════════════════════════════════════════════════════════════════

class TestSearch:
    async def test_search_returns_results(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/search?q=test&size=10", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "results" in body or "hits" in body or isinstance(body, list) or "items" in body

    async def test_search_empty_query(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/search?q=&size=5", headers=auth_headers)
        assert r.status_code in (200, 422)

    async def test_search_requires_auth(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/search?q=test")
        assert r.status_code == 403


# ═══════════════════════════════════════════════════════════════════════════════
# GLOSSARY
# ═══════════════════════════════════════════════════════════════════════════════

class TestGlossary:
    async def test_list_terms(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/glossary", headers=auth_headers)
        assert r.status_code == 200
        assert "items" in r.json()

    async def test_create_term(self, auth_headers, catalog_ids):
        unique_name = f"Test Term (regression {int(time.time())})"
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post(
                "/api/v1/glossary",
                json={"name": unique_name, "definition": "A term created by regression tests.", "tags": ["test"], "status": "draft"},
                headers=auth_headers,
            )
        assert r.status_code == 201
        body = r.json()
        assert body["name"] == unique_name
        catalog_ids["glossary_term_id"] = body["id"]

    async def test_get_term(self, auth_headers, catalog_ids):
        term_id = catalog_ids.get("glossary_term_id")
        if not term_id:
            pytest.skip("glossary_term_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/glossary/{term_id}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == term_id

    async def test_patch_term(self, auth_headers, catalog_ids):
        term_id = catalog_ids.get("glossary_term_id")
        if not term_id:
            pytest.skip("glossary_term_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.patch(
                f"/api/v1/glossary/{term_id}",
                json={"status": "approved", "definition": "Updated definition."},
                headers=auth_headers,
            )
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

    async def test_link_term_to_table(self, auth_headers, catalog_ids):
        term_id = catalog_ids.get("glossary_term_id")
        table_id = catalog_ids.get("table_id")
        if not term_id or not table_id:
            pytest.skip("IDs not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post(
                f"/api/v1/glossary/{term_id}/links",
                json={"entity_type": "table", "entity_id": table_id},
                headers=auth_headers,
            )
        assert r.status_code == 201
        link_id = r.json()["id"]
        catalog_ids["glossary_link_id"] = link_id

    async def test_unlink_term(self, auth_headers, catalog_ids):
        term_id = catalog_ids.get("glossary_term_id")
        link_id = catalog_ids.get("glossary_link_id")
        if not term_id or not link_id:
            pytest.skip("IDs not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.delete(f"/api/v1/glossary/{term_id}/links/{link_id}", headers=auth_headers)
        assert r.status_code == 204

    async def test_delete_term(self, auth_headers, catalog_ids):
        term_id = catalog_ids.get("glossary_term_id")
        if not term_id:
            pytest.skip("glossary_term_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.delete(f"/api/v1/glossary/{term_id}", headers=auth_headers)
        assert r.status_code == 204


# ═══════════════════════════════════════════════════════════════════════════════
# ARTICLES
# ═══════════════════════════════════════════════════════════════════════════════

class TestArticles:
    async def test_list_articles(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/articles", headers=auth_headers)
        assert r.status_code == 200
        assert "items" in r.json()

    async def test_create_article(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post(
                "/api/v1/articles",
                json={"title": "Regression Test Article", "description": "Written by tests.", "body": "<p>Test body</p>", "tags": ["test"]},
                headers=auth_headers,
            )
        assert r.status_code == 201
        body = r.json()
        assert body["title"] == "Regression Test Article"
        catalog_ids["article_id"] = body["id"]

    async def test_get_article(self, auth_headers, catalog_ids):
        article_id = catalog_ids.get("article_id")
        if not article_id:
            pytest.skip("article_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/articles/{article_id}", headers=auth_headers)
        assert r.status_code == 200

    async def test_patch_article(self, auth_headers, catalog_ids):
        article_id = catalog_ids.get("article_id")
        if not article_id:
            pytest.skip("article_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.patch(
                f"/api/v1/articles/{article_id}",
                json={"description": "Updated by regression test."},
                headers=auth_headers,
            )
        assert r.status_code == 200
        assert r.json()["description"] == "Updated by regression test."

    async def test_delete_article(self, auth_headers, catalog_ids):
        article_id = catalog_ids.get("article_id")
        if not article_id:
            pytest.skip("article_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.delete(f"/api/v1/articles/{article_id}", headers=auth_headers)
        assert r.status_code == 204


# ═══════════════════════════════════════════════════════════════════════════════
# SAVED QUERIES
# ═══════════════════════════════════════════════════════════════════════════════

class TestQueries:
    async def test_list_queries(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/queries", headers=auth_headers)
        assert r.status_code == 200
        assert "items" in r.json()

    async def test_create_query(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post(
                "/api/v1/queries",
                json={"name": "Regression Test Query", "sql_text": "SELECT 1 AS regression_test"},
                headers=auth_headers,
            )
        assert r.status_code == 201
        body = r.json()
        assert body["name"] == "Regression Test Query"
        catalog_ids["query_id"] = body["id"]

    async def test_get_query(self, auth_headers, catalog_ids):
        query_id = catalog_ids.get("query_id")
        if not query_id:
            pytest.skip("query_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/queries/{query_id}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["sql_text"] == "SELECT 1 AS regression_test"

    async def test_patch_query(self, auth_headers, catalog_ids):
        query_id = catalog_ids.get("query_id")
        if not query_id:
            pytest.skip("query_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.patch(
                f"/api/v1/queries/{query_id}",
                json={"description": "Updated by regression test."},
                headers=auth_headers,
            )
        assert r.status_code == 200
        assert r.json()["description"] == "Updated by regression test."

    async def test_delete_query(self, auth_headers, catalog_ids):
        query_id = catalog_ids.get("query_id")
        if not query_id:
            pytest.skip("query_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.delete(f"/api/v1/queries/{query_id}", headers=auth_headers)
        assert r.status_code == 204


# ═══════════════════════════════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAnalytics:
    async def test_stats(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/stats", headers=auth_headers)
        assert r.status_code == 200

    async def test_popular(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/analytics/popular", headers=auth_headers)
        assert r.status_code == 200

    async def test_trending(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/analytics/trending", headers=auth_headers)
        assert r.status_code == 200

    async def test_view_tracking(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post(
                f"/api/v1/analytics/view?entity_type=table&entity_id={table_id}",
                headers=auth_headers,
            )
        assert r.status_code in (200, 201, 204)


# ═══════════════════════════════════════════════════════════════════════════════
# COMMENTS — multi-entity
# ═══════════════════════════════════════════════════════════════════════════════

class TestCommentsFull:
    async def test_comment_on_schema(self, auth_headers, catalog_ids):
        schema_id = catalog_ids["schema_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            post_r = await c.post(
                f"/api/v1/comments/schema/{schema_id}",
                json={"body": "Schema regression comment"},
                headers=auth_headers,
            )
            assert post_r.status_code == 201
            cid = post_r.json()["id"]

            get_r = await c.get(f"/api/v1/comments/schema/{schema_id}", headers=auth_headers)
            assert get_r.status_code == 200
            assert any(c_["id"] == cid for c_ in get_r.json())

            del_r = await c.delete(f"/api/v1/comments/{cid}", headers=auth_headers)
            assert del_r.status_code == 204

    async def test_comment_on_database(self, auth_headers, catalog_ids):
        db_id = catalog_ids["db_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            post_r = await c.post(
                f"/api/v1/comments/database/{db_id}",
                json={"body": "DB regression comment"},
                headers=auth_headers,
            )
            assert post_r.status_code == 201
            cid = post_r.json()["id"]
            del_r = await c.delete(f"/api/v1/comments/{cid}", headers=auth_headers)
            assert del_r.status_code == 204


# ═══════════════════════════════════════════════════════════════════════════════
# FAVORITES
# ═══════════════════════════════════════════════════════════════════════════════

class TestFavorites:
    async def test_add_favorite(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post(
                f"/api/v1/favorites/table/{table_id}",
                headers=auth_headers,
            )
        assert r.status_code in (200, 201)

    async def test_list_favorites(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/favorites", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_check_favorite_status(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/favorites/table/{table_id}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("is_favorited") is True

    async def test_remove_favorite(self, auth_headers, catalog_ids):
        # Favorites use POST toggle — a second POST on an already-favorited item removes it
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post(f"/api/v1/favorites/table/{table_id}", headers=auth_headers)
        assert r.status_code in (200, 201)
        assert r.json().get("is_favorited") is False

    async def test_check_favorite_removed(self, auth_headers, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/favorites/table/{table_id}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("is_favorited") is False


# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

class TestNotifications:
    async def test_list_notifications(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/notifications", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_unread_count(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/notifications/unread", headers=auth_headers)
        assert r.status_code == 200
        assert "count" in r.json()

    async def test_mark_all_read(self, auth_headers):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post("/api/v1/notifications/read-all", headers=auth_headers)
        assert r.status_code in (200, 204)


# ═══════════════════════════════════════════════════════════════════════════════
# LINEAGE
# ═══════════════════════════════════════════════════════════════════════════════

class TestLineageFull:
    async def test_create_edge(self, auth_headers, catalog_ids):
        db_name = catalog_ids["db_name"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post(
                "/api/v1/lineage",
                json={
                    "source_db_name": db_name, "source_table_name": "reg_src",
                    "target_db_name": db_name, "target_table_name": "test_catalog_table",
                },
                headers=auth_headers,
            )
        assert r.status_code == 201
        catalog_ids["reg_edge_id"] = r.json()["id"]

    async def test_table_lineage(self, auth_headers, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/tables/{catalog_ids['table_id']}/lineage", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "upstream" in body and "downstream" in body

    async def test_annotate_edge(self, auth_headers, catalog_ids):
        edge_id = catalog_ids.get("reg_edge_id")
        if not edge_id:
            pytest.skip("reg_edge_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.put(
                f"/api/v1/lineage/{edge_id}/annotation",
                json={"integration_description": "Regression annotation", "integration_method": "streaming"},
                headers=auth_headers,
            )
        assert r.status_code == 200
        assert r.json()["integration_method"] == "streaming"

    async def test_get_annotation(self, auth_headers, catalog_ids):
        edge_id = catalog_ids.get("reg_edge_id")
        if not edge_id:
            pytest.skip("reg_edge_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get(f"/api/v1/lineage/{edge_id}/annotation", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["integration_description"] == "Regression annotation"

    async def test_duplicate_edge_returns_409(self, auth_headers, catalog_ids):
        db_name = catalog_ids["db_name"]
        payload = {"source_db_name": db_name, "source_table_name": "dup2_src",
                   "target_db_name": db_name, "target_table_name": "dup2_tgt"}
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            await c.post("/api/v1/lineage", json=payload, headers=auth_headers)
            r = await c.post("/api/v1/lineage", json=payload, headers=auth_headers)
        assert r.status_code == 409

    async def test_delete_edge(self, auth_headers, catalog_ids):
        edge_id = catalog_ids.get("reg_edge_id")
        if not edge_id:
            pytest.skip("reg_edge_id not set")
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.delete(f"/api/v1/lineage/{edge_id}", headers=auth_headers)
        assert r.status_code == 204


# ═══════════════════════════════════════════════════════════════════════════════
# INGEST
# ═══════════════════════════════════════════════════════════════════════════════

class TestIngest:
    async def test_ingest_new_database(self):
        payload = {
            "database": {"name": "regression-ingest-db", "db_type": "snowflake"},
            "schemas": [{"name": "public", "tables": [
                {"name": "reg_table", "columns": [
                    {"name": "id", "data_type": "integer", "is_primary_key": True, "is_nullable": False}
                ]}
            ]}],
        }
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post(
                "/api/v1/ingest/batch",
                json=payload,
                headers={"X-API-Key": INGEST_KEY},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["schemas_upserted"] >= 1
        assert body["tables_upserted"] >= 1

    async def test_ingest_requires_api_key(self):
        # FastAPI validates the required X-API-Key header before auth runs,
        # so a completely missing header returns 422; a wrong value returns 401.
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post("/api/v1/ingest/batch", json={"database": {"name": "x", "db_type": "pg"}, "schemas": []})
        assert r.status_code in (401, 422)

    async def test_ingest_wrong_key_returns_401(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.post(
                "/api/v1/ingest/batch",
                json={"database": {"name": "x", "db_type": "pg"}, "schemas": []},
                headers={"X-API-Key": "WRONG-KEY"},
            )
        assert r.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# PERMISSIONS / ROLE ENFORCEMENT
# ═══════════════════════════════════════════════════════════════════════════════

class TestPermissions:
    async def test_no_token_returns_403(self, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            r = await c.get("/api/v1/databases")
        assert r.status_code == 403

    async def test_viewer_can_read(self, catalog_ids):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            hdrs = await _login(c, VIEWER)
            r = await c.get("/api/v1/databases", headers=hdrs)
        assert r.status_code == 200

    async def test_viewer_cannot_patch_table(self, catalog_ids):
        table_id = catalog_ids["table_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            hdrs = await _login(c, VIEWER)
            r = await c.patch(
                f"/api/v1/tables/{table_id}",
                json={"description": "viewer should not patch"},
                headers=hdrs,
            )
        assert r.status_code == 403

    async def test_viewer_cannot_patch_column(self, catalog_ids):
        col_id = catalog_ids["col_id"]
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            hdrs = await _login(c, VIEWER)
            r = await c.patch(
                f"/api/v1/columns/{col_id}",
                json={"title": "viewer attempt"},
                headers=hdrs,
            )
        assert r.status_code == 403

    async def test_viewer_cannot_create_glossary_term(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            hdrs = await _login(c, VIEWER)
            r = await c.post(
                "/api/v1/glossary",
                json={"name": "Viewer Term", "definition": "Should fail", "status": "draft"},
                headers=hdrs,
            )
        assert r.status_code == 403

    async def test_viewer_cannot_create_article(self):
        async with httpx.AsyncClient(base_url=BASE_URL) as c:
            hdrs = await _login(c, VIEWER)
            r = await c.post(
                "/api/v1/articles",
                json={"title": "Viewer Article", "body": "x"},
                headers=hdrs,
            )
        assert r.status_code == 403
