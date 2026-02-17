"""
Data Catalog Stress Test — 50 concurrent users
  - 40 ViewerUsers  : read-heavy (browse, search, navigate sidebar tree)
  - 10 StewardUsers : read + write (patch descriptions/tags on tables/columns)

Run headlessly (50 users, 5 spawned/s, 3 min):
    locust -f locustfile.py --headless -u 50 -r 5 -t 3m --html report.html

Run with live web UI:
    locust -f locustfile.py
    → open http://localhost:8089, set host=http://localhost:8001
"""

import random
import threading
import time

from locust import HttpUser, between, events, task
from locust.runners import MasterRunner, WorkerRunner

BASE = "/api/v1"

# ─── Shared catalog ID pools (populated once on test start) ───────────────────
_catalog: dict = {
    "db_ids": [],
    "schema_ids": [],       # list of (schema_id, db_id)
    "table_ids": [],        # list of (table_id, schema_id)
    "column_ids": [],       # list of (col_id, table_id)
    "query_ids": [],
    "glossary_ids": [],
}
_catalog_lock = threading.Lock()
_catalog_ready = threading.Event()


def _seed_catalog(environment):
    """Fetch a sample of IDs before users start hitting the API."""
    base_url = environment.host or "http://localhost:8001"
    import requests

    session = requests.Session()

    # Log in as steward to seed
    try:
        r = session.post(f"{base_url}/auth/login",
                         json={"email": "steward@demo.com", "password": "steward123"},
                         timeout=10)
        if r.status_code != 200:
            print(f"[seed] login failed ({r.status_code}), catalog will be empty")
            _catalog_ready.set()
            return
        token = r.json()["access_token"]
    except Exception as e:
        print(f"[seed] cannot reach backend: {e}")
        _catalog_ready.set()
        return

    headers = {"Authorization": f"Bearer {token}"}

    # Databases
    r = session.get(f"{base_url}{BASE}/databases?size=50", headers=headers, timeout=10)
    dbs = r.json().get("items", []) if r.ok else []
    db_ids = [d["id"] for d in dbs]

    schema_ids, table_ids, col_ids = [], [], []
    for db_id in db_ids[:5]:   # sample first 5 DBs to keep seed fast
        r = session.get(f"{base_url}{BASE}/databases/{db_id}/schemas?size=20",
                        headers=headers, timeout=10)
        schemas = r.json().get("items", []) if r.ok else []
        for s in schemas[:4]:
            schema_ids.append((s["id"], db_id))
            r2 = session.get(f"{base_url}{BASE}/schemas/{s['id']}/tables?size=20",
                             headers=headers, timeout=10)
            tables = r2.json().get("items", []) if r2.ok else []
            for t in tables[:5]:
                table_ids.append((t["id"], s["id"]))
                r3 = session.get(f"{base_url}{BASE}/tables/{t['id']}/columns?size=20",
                                 headers=headers, timeout=10)
                cols = r3.json().get("items", []) if r3.ok else []
                col_ids.extend([(c["id"], t["id"]) for c in cols[:5]])

    r = session.get(f"{base_url}{BASE}/queries?size=30", headers=headers, timeout=10)
    query_ids = [q["id"] for q in r.json().get("items", [])] if r.ok else []

    r = session.get(f"{base_url}{BASE}/glossary?size=30", headers=headers, timeout=10)
    glossary_ids = [g["id"] for g in r.json().get("items", [])] if r.ok else []

    with _catalog_lock:
        _catalog["db_ids"] = db_ids
        _catalog["schema_ids"] = schema_ids
        _catalog["table_ids"] = table_ids
        _catalog["column_ids"] = col_ids
        _catalog["query_ids"] = query_ids
        _catalog["glossary_ids"] = glossary_ids

    print(f"[seed] dbs={len(db_ids)} schemas={len(schema_ids)} "
          f"tables={len(table_ids)} cols={len(col_ids)} "
          f"queries={len(query_ids)} glossary={len(glossary_ids)}")
    _catalog_ready.set()


@events.test_start.add_listener
def on_test_start(environment, **_kwargs):
    if not isinstance(environment.runner, WorkerRunner):
        t = threading.Thread(target=_seed_catalog, args=(environment,), daemon=True)
        t.start()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _pick(pool, fallback=None):
    return random.choice(pool) if pool else fallback


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ─── Base user ────────────────────────────────────────────────────────────────

class CatalogUser(HttpUser):
    abstract = True
    wait_time = between(0.5, 2.5)    # think time between requests
    _token: str = ""

    def on_start(self):
        _catalog_ready.wait(timeout=30)
        self._login()

    def _login(self):
        raise NotImplementedError

    def _get(self, path, name=None, **kwargs):
        if not self._token:
            return None
        return self.client.get(
            path,
            headers=_auth_headers(self._token),
            name=name or path,
            **kwargs,
        )

    def _patch(self, path, payload, name=None):
        if not self._token:
            return None
        return self.client.patch(
            path,
            json=payload,
            headers=_auth_headers(self._token),
            name=name or path,
        )

    # ── Common reads shared by both user types ─────────────────────────────

    def read_databases(self):
        self._get(f"{BASE}/databases?page=1&size=20", name="GET /databases")

    def read_schemas(self):
        db_id = _pick(_catalog["db_ids"])
        if db_id:
            self._get(f"{BASE}/databases/{db_id}/schemas?size=20",
                      name="GET /databases/:id/schemas")

    def read_tables(self):
        pair = _pick(_catalog["schema_ids"])
        if pair:
            schema_id, _ = pair
            self._get(f"{BASE}/schemas/{schema_id}/tables?size=20",
                      name="GET /schemas/:id/tables")

    def read_table_context(self):
        pair = _pick(_catalog["table_ids"])
        if pair:
            table_id, _ = pair
            self._get(f"{BASE}/tables/{table_id}/context",
                      name="GET /tables/:id/context")

    def read_columns(self):
        pair = _pick(_catalog["table_ids"])
        if pair:
            table_id, _ = pair
            self._get(f"{BASE}/tables/{table_id}/columns?size=50",
                      name="GET /tables/:id/columns")

    def read_column_context(self):
        pair = _pick(_catalog["column_ids"])
        if pair:
            col_id, _ = pair
            self._get(f"{BASE}/columns/{col_id}/context",
                      name="GET /columns/:id/context")

    def read_search(self):
        terms = ["customer", "order", "product", "user", "id", "date", "price", "status"]
        self._get(f"{BASE}/search?q={random.choice(terms)}&size=10",
                  name="GET /search")

    def read_dashboard(self):
        self._get(f"{BASE}/stats", name="GET /stats")
        self._get(f"{BASE}/analytics/popular", name="GET /analytics/popular")
        self._get(f"{BASE}/analytics/trending", name="GET /analytics/trending")

    def read_query(self):
        qid = _pick(_catalog["query_ids"])
        if qid:
            self._get(f"{BASE}/queries/{qid}", name="GET /queries/:id")
        else:
            self._get(f"{BASE}/queries?size=20", name="GET /queries")

    def read_glossary(self):
        gid = _pick(_catalog["glossary_ids"])
        if gid:
            self._get(f"{BASE}/glossary/{gid}", name="GET /glossary/:id")
        else:
            self._get(f"{BASE}/glossary?size=20", name="GET /glossary")

    def read_me(self):
        self._get("/auth/me", name="GET /auth/me")


# ─── Viewer user (40 users) — read only ───────────────────────────────────────

class ViewerUser(CatalogUser):
    weight = 40
    wait_time = between(0.3, 2.0)

    def _login(self):
        # Jitter so 40 users don't all hit the rate limiter (10/min) at once
        time.sleep(random.uniform(0, 8))
        for attempt in range(3):
            r = self.client.post("/auth/login",
                                 json={"email": "viewer@demo.com", "password": "viewer123"},
                                 name="POST /auth/login (viewer)")
            if r.status_code == 200:
                self._token = r.json()["access_token"]
                return
            if r.status_code == 429:
                time.sleep(7 + attempt * 3)
        # If all retries fail the user simply makes no requests (token stays "")

    @task(10)
    def task_list_databases(self):
        self.read_databases()

    @task(9)
    def task_list_schemas(self):
        self.read_schemas()

    @task(9)
    def task_list_tables(self):
        self.read_tables()

    @task(8)
    def task_list_columns(self):
        self.read_columns()

    @task(7)
    def task_table_context(self):
        self.read_table_context()

    @task(6)
    def task_column_context(self):
        self.read_column_context()

    @task(6)
    def task_search(self):
        self.read_search()

    @task(4)
    def task_dashboard(self):
        self.read_dashboard()

    @task(3)
    def task_query(self):
        self.read_query()

    @task(3)
    def task_glossary(self):
        self.read_glossary()

    @task(2)
    def task_me(self):
        self.read_me()


# ─── Steward user (10 users) — read + write ───────────────────────────────────

class StewardUser(CatalogUser):
    weight = 10
    wait_time = between(1.0, 3.5)   # stewards think a bit longer before editing

    def _login(self):
        time.sleep(random.uniform(0, 3))
        for attempt in range(3):
            r = self.client.post("/auth/login",
                                 json={"email": "steward@demo.com", "password": "steward123"},
                                 name="POST /auth/login (steward)")
            if r.status_code == 200:
                self._token = r.json()["access_token"]
                return
            if r.status_code == 429:
                time.sleep(7 + attempt * 3)

    # Reads (same as viewer)
    @task(8)
    def task_list_databases(self):
        self.read_databases()

    @task(7)
    def task_list_schemas(self):
        self.read_schemas()

    @task(7)
    def task_list_tables(self):
        self.read_tables()

    @task(6)
    def task_list_columns(self):
        self.read_columns()

    @task(5)
    def task_table_context(self):
        self.read_table_context()

    @task(4)
    def task_search(self):
        self.read_search()

    @task(2)
    def task_dashboard(self):
        self.read_dashboard()

    # Writes
    @task(3)
    def task_patch_table(self):
        pair = _pick(_catalog["table_ids"])
        if not pair:
            return
        table_id, _ = pair
        tags = random.sample(["pii", "finance", "core", "staging", "verified", "raw"], k=2)
        desc = random.choice([
            "Contains transactional records for the billing system.",
            "Primary dimension table used in reporting.",
            "Source-of-truth table synced nightly from upstream.",
            "Staging table; do not use in production reports.",
        ])
        self._patch(f"{BASE}/tables/{table_id}",
                    {"description": desc, "tags": tags},
                    name="PATCH /tables/:id")

    @task(3)
    def task_patch_column(self):
        pair = _pick(_catalog["column_ids"])
        if not pair:
            return
        col_id, _ = pair
        titles = ["Customer ID", "Order Date", "Product SKU", "Status Code",
                  "Created At", "Amount (USD)", "User Email", "Region Key"]
        tags = random.sample(["pii", "indexed", "nullable", "fk", "pk"], k=1)
        self._patch(f"{BASE}/columns/{col_id}",
                    {"title": random.choice(titles), "tags": tags},
                    name="PATCH /columns/:id")

    @task(2)
    def task_patch_schema(self):
        pair = _pick(_catalog["schema_ids"])
        if not pair:
            return
        schema_id, _ = pair
        desc = random.choice([
            "Analytics schema — aggregated metrics for BI dashboards.",
            "Raw ingestion schema; data direct from source systems.",
            "Public-facing API schema with strict SLA guarantees.",
        ])
        self._patch(f"{BASE}/schemas/{schema_id}",
                    {"description": desc},
                    name="PATCH /schemas/:id")

    @task(1)
    def task_patch_database(self):
        db_id = _pick(_catalog["db_ids"])
        if not db_id:
            return
        desc = random.choice([
            "Primary production warehouse.",
            "Replica used for analytics queries.",
            "Legacy system; being phased out Q4.",
        ])
        self._patch(f"{BASE}/databases/{db_id}",
                    {"description": desc},
                    name="PATCH /databases/:id")
