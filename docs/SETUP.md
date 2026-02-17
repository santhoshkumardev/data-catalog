# Data Catalog — Setup Instructions

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| **Docker** | 20.10+ | Container runtime |
| **Docker Compose** | 2.0+ (V2 plugin) | Service orchestration |
| **Git** | 2.30+ | Source control |
| **curl** (optional) | Any | API testing |

Verify your installations:

```bash
docker --version
docker compose version
git --version
```

## Step 1 — Clone the Repository

```bash
git clone https://github.com/santhoshkumardev/data-catalog.git
cd data-catalog
```

## Step 2 — Configure Environment Variables

Create a `.env` file in the project root. Start by copying the example below and adjusting values as needed:

```bash
# ─── Database ────────────────────────────────────────────
POSTGRES_USER=catalog
POSTGRES_PASSWORD=catalogpass
POSTGRES_DB=datacatalog

# ─── Redis ───────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ─── Meilisearch ─────────────────────────────────────────
MEILISEARCH_URL=http://meilisearch:7700
MEILISEARCH_API_KEY=dev-meili-master-key

# ─── MinIO (S3-compatible storage) ───────────────────────
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=data-catalog
MINIO_USE_SSL=false

# ─── JWT / Auth ──────────────────────────────────────────
JWT_SECRET=change-me-to-a-random-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480

# ─── Ingest API Key ─────────────────────────────────────
INGEST_API_KEY=dev-ingest-key

# ─── URLs ────────────────────────────────────────────────
APP_BASE_URL=http://localhost:8001
FRONTEND_URL=http://localhost:3001

# ─── OAuth (optional — configure one or more) ───────────
# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Azure AD
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=

# Generic OIDC
OIDC_ISSUER_URL=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_ADMIN_GROUP=
OIDC_STEWARD_GROUP=
```

> **Important:** For production deployments, change `JWT_SECRET` to a strong random value and use real credentials for all services.

## Step 3 — Start All Services

Launch the entire stack with Docker Compose:

```bash
docker compose up -d
```

This starts six services:

| Service | Port | Description |
|---------|------|-------------|
| **db** (PostgreSQL) | 5433 | Primary data store |
| **redis** | 6379 | Cache and session store |
| **meilisearch** | 7700 | Full-text search engine |
| **minio** | 9000 (API), 9001 (UI) | Object storage for attachments |
| **backend** | 8001 | FastAPI application |
| **frontend** | 3001 | React web interface |

Wait for all services to become healthy (approximately 30–60 seconds):

```bash
docker compose ps
```

All services should show `healthy` or `running` status.

## Step 4 — Run Database Migrations

Apply the database schema:

```bash
docker compose exec backend alembic upgrade head
```

You should see output similar to:

```
INFO  [alembic.runtime.migration] Running upgrade  -> 0001, v2 full schema
INFO  [alembic.runtime.migration] Running upgrade 0001 -> 0002, add column title
INFO  [alembic.runtime.migration] Running upgrade 0002 -> 0003, add object_type and view_definition to tables
INFO  [alembic.runtime.migration] Running upgrade 0003 -> 0004, add groups and endorsements
INFO  [alembic.runtime.migration] Running upgrade 0004 -> 0005, add stewardship assignments
```

## Step 5 — Create Demo Users

Create initial user accounts for testing:

```bash
docker compose exec backend python create_demo_users.py
```

This creates three users with different roles:

| Email | Password | Role |
|-------|----------|------|
| `admin@demo.com` | `admin123` | Admin |
| `steward@demo.com` | `steward123` | Steward |
| `viewer@demo.com` | `viewer123` | Viewer |

## Step 6 — Seed Sample Data

Load the catalog with realistic sample data:

```bash
# Seed database metadata (databases, schemas, tables, columns)
docker compose exec backend python seed_data.py

# Seed data lineage edges
docker compose exec backend python seed_lineage.py

# Seed documentation articles
docker compose exec backend python seed_articles.py

# Seed saved SQL queries
docker compose exec backend python seed_queries.py

# Seed business glossary terms
docker compose exec backend python seed_glossary.py
```

Each script logs what it creates. The full seed populates:

- 6 databases with multiple schemas
- 60+ tables with columns
- 30+ lineage edges across databases
- 10 documentation articles
- Sample saved queries
- Business glossary terms

## Step 7 — Access the Application

Open your browser and navigate to:

```
http://localhost:3001
```

Log in with one of the demo accounts (e.g., `steward@demo.com` / `steward123`).

You should see the dashboard with:

- Statistics cards showing database, schema, table, and column counts
- An AI-powered search bar
- A sidebar tree with all databases and schemas
- Navigation to all catalog features

## Step 8 — Ingest Custom Metadata (Optional)

To ingest your own database metadata, send a POST request to the ingestion API:

```bash
curl -X POST http://localhost:8001/api/v1/ingest/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-ingest-key" \
  -d '{
    "database": {
      "name": "my_database",
      "db_type": "postgresql"
    },
    "schemas": [
      {
        "name": "public",
        "tables": [
          {
            "name": "users",
            "object_type": "table",
            "row_count": 10000,
            "columns": [
              { "name": "id", "data_type": "BIGINT", "is_nullable": false, "is_primary_key": true },
              { "name": "email", "data_type": "VARCHAR(255)", "is_nullable": false },
              { "name": "created_at", "data_type": "TIMESTAMP", "is_nullable": false }
            ]
          },
          {
            "name": "active_users_vw",
            "object_type": "view",
            "view_definition": "SELECT id, email, created_at FROM users WHERE is_active = true",
            "columns": [
              { "name": "id", "data_type": "BIGINT", "is_nullable": false },
              { "name": "email", "data_type": "VARCHAR(255)", "is_nullable": false },
              { "name": "created_at", "data_type": "TIMESTAMP", "is_nullable": false }
            ]
          }
        ]
      }
    ]
  }'
```

The `object_type` field supports: `table`, `view`, `materialized_view`, `synonym`. If omitted, it defaults to `table`.

## Useful Commands

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Rebuilding After Code Changes

```bash
# Rebuild and restart backend and frontend
DOCKER_BUILDKIT=0 docker-compose build backend frontend
docker compose up -d backend frontend
```

> **Note:** Use `DOCKER_BUILDKIT=0` (legacy builder) if you encounter network timeouts pulling base images. It reuses cached layers more aggressively.

For Python-only backend changes (no new dependencies), a restart is sufficient — no rebuild needed:

```bash
docker compose restart backend
```

### Running a New Migration

```bash
docker compose exec backend alembic upgrade head
```

### Accessing the Database Directly

```bash
# PostgreSQL shell
docker compose exec db psql -U catalog -d datacatalog

# Example queries
SELECT name, object_type FROM tables LIMIT 10;
SELECT COUNT(*) FROM tables GROUP BY object_type;
```

### Accessing MinIO UI

Navigate to `http://localhost:9001` and log in with:

- Username: `minioadmin`
- Password: `minioadmin`

### Accessing Meilisearch Dashboard

Navigate to `http://localhost:7700` to view search indexes and test queries.

### Triggering a Full Search Reindex

If search results are stale or out of sync:

1. Log in as an admin or steward
2. Go to the Admin page
3. Click "Reindex" to rebuild all Meilisearch indexes from the database

Or via the API:

```bash
# Get a JWT token first by logging in
TOKEN=$(curl -s -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo.com", "password": "admin123"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# Trigger reindex
curl -X POST http://localhost:8001/api/v1/admin/reindex \
  -H "Authorization: Bearer $TOKEN"
```

### Running Integration Tests

The test suite runs against the live Docker stack. Ensure all services are up and demo users have been created before running tests.

```bash
# Install test dependencies (one-time)
pip install -r backend/requirements-test.txt

# Run all integration tests
cd backend
pytest tests/ -v
```

The tests cover:
- PATCH endpoints for database, schema, table, and column metadata
- Comment creation, retrieval, and deletion
- Lineage edge creation, annotation, and deletion
- Permission enforcement (403 for unauthenticated and viewer roles)

> **Note:** Tests connect to the running stack at `http://localhost:8001` using the demo steward credentials (`steward@demo.com` / `steward123`) and the ingest API key (`dev-ingest-key`). A test database is created and cleaned up automatically.

### Stopping All Services

```bash
docker compose down
```

To also remove all data volumes (fresh start):

```bash
docker compose down -v
```

## Troubleshooting

### Backend won't start

**Check logs:**
```bash
docker compose logs backend
```

**Common causes:**
- Database not ready yet — wait for the health check or restart: `docker compose restart backend`
- Missing `.env` file — ensure it exists in the project root
- Port 8001 already in use — change the port mapping in `docker-compose.yml`

### Frontend shows blank page

- Ensure the backend is running and healthy
- Check the browser console for CORS errors
- Verify `FRONTEND_URL` in `.env` matches the URL you're accessing

### Search returns no results

- Ensure Meilisearch is running: `docker compose ps meilisearch`
- Trigger a reindex from the Admin page
- Check that the `MEILISEARCH_API_KEY` in `.env` matches the key set on the Meilisearch container

### Migration fails

- Ensure the database is running: `docker compose ps db`
- Check if a migration was partially applied: `docker compose exec backend alembic current`
- View migration history: `docker compose exec backend alembic history`

### Cannot log in

- Ensure demo users were created (Step 5)
- For OAuth login, verify the OAuth provider credentials in `.env`
- Check rate limiting — the login endpoint is limited to 10 requests per minute
