# Data Catalog — Architecture

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Browser (Port 3001)                        │
│                  React 18 + TypeScript + TailwindCSS                  │
│                        Vite Dev Server / Nginx                        │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ REST API (JSON over HTTPS)
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Backend API (Port 8001)                        │
│                    FastAPI + Uvicorn (ASGI)                           │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Middleware  │  │  16 API    │  │   Services   │  │    Auth     │  │
│  │  Pipeline   │  │  Routers   │  │  (business   │  │  (OAuth2 +  │  │
│  │            │  │            │  │   logic)     │  │   JWT)      │  │
│  └────────────┘  └────────────┘  └──────────────┘  └─────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  SQLAlchemy 2.0 ORM (async)                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────┬──────────────┬───────────────┬──────────────┬────────────────┘
       │              │               │              │
       ▼              ▼               ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ PostgreSQL │ │   Redis    │ │Meilisearch │ │   MinIO    │
│   16       │ │     7      │ │   v1.6     │ │  (S3)      │
│            │ │            │ │            │ │            │
│ Port 5433  │ │ Port 6379  │ │ Port 7700  │ │ Port 9000  │
│            │ │            │ │            │ │  UI: 9001  │
│ Primary    │ │ Token      │ │ Full-text  │ │ File       │
│ data store │ │ blacklist, │ │ search     │ │ storage    │
│            │ │ cache      │ │ (7 indexes)│ │ (articles) │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

## Technology Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Python** | 3.12 | Runtime |
| **FastAPI** | 0.115.0 | REST API framework |
| **Uvicorn** | 0.30.6 | ASGI server |
| **SQLAlchemy** | 2.0.35 | ORM with async support |
| **asyncpg** | 0.29.0 | PostgreSQL async driver |
| **Alembic** | 1.13.2 | Database migrations |
| **Pydantic** | 2.9.2 | Request/response validation |
| **python-jose** | 3.3.0 | JWT token handling |
| **authlib** | 1.3.2 | OAuth 2.0 client |
| **passlib + bcrypt** | 1.7.4 / 4.0.1 | Password hashing |
| **nh3** | 0.2.18 | HTML sanitization |
| **redis** | 5.1.0 | Redis client |
| **slowapi** | 0.1.9 | Rate limiting |
| **meilisearch** | 0.31.4 | Search engine client |
| **boto3** | 1.35.0 | S3/MinIO client |
| **structlog** | 24.4.0 | Structured logging |
| **httpx** | 0.27.2 | Async HTTP client |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **TypeScript** | — | Type safety |
| **Vite** | 5.4.x | Build tool and dev server |
| **React Router** | 6.26.2 | Client-side routing |
| **Axios** | 1.7.7 | HTTP client |
| **TailwindCSS** | 3.4.13 | Utility-first CSS |
| **Lucide React** | 0.447.0 | Icon library |
| **TipTap** | 2.10.4 | Rich-text editor (articles) |
| **TanStack Query** | 5.59.0 | Server state caching and deduplication |
| **CodeMirror** | 4.23.7 | SQL editor |
| **DOMPurify** | 3.1.7 | HTML sanitization |

### Infrastructure

| Service | Image | Port(s) | Purpose |
|---------|-------|---------|---------|
| **PostgreSQL** | postgres:16-alpine | 5433 | Primary data store |
| **Redis** | redis:7-alpine | 6379 | Cache, sessions, token blacklist |
| **Meilisearch** | getmeili/meilisearch:v1.6 | 7700 | Full-text search engine |
| **MinIO** | minio/minio | 9000, 9001 | S3-compatible object storage |
| **Backend** | Custom Dockerfile | 8001 | FastAPI application |
| **Frontend** | Custom Dockerfile (multi-stage) | 3001 | Nginx serving React SPA |

## Backend Architecture

### Request Pipeline

```
Incoming HTTP Request
  │
  ├─ RequestIdMiddleware     → Assigns unique X-Request-ID
  ├─ LoggingMiddleware       → Structured request/response logging
  ├─ CORSMiddleware          → Cross-origin policy enforcement
  ├─ SessionMiddleware       → Session management
  │
  ├─ Authentication Layer
  │   ├─ Bearer JWT Token    → For user requests (OAuth/local login)
  │   └─ X-API-Key Header    → For ingestion endpoints
  │
  ├─ Rate Limiting (slowapi) → Per-endpoint throttling
  │
  └─ Router Handler          → Business logic execution
```

### API Routers (15 total)

| Router | Prefix | Auth | Description |
|--------|--------|------|-------------|
| **auth** | `/api/v1/auth` | Public | Login (OAuth + local), logout, user info |
| **catalog** | `/api/v1` | User | CRUD for databases, schemas, tables, columns |
| **search** | `/api/v1/search` | User | Full-text search across all indexes |
| **ingest** | `/api/v1/ingest` | API Key | Bulk metadata and lineage ingestion |
| **lineage** | `/api/v1` | User/Steward | Lineage graph queries and edge management |
| **queries** | `/api/v1/queries` | User | Saved SQL query CRUD |
| **articles** | `/api/v1/articles` | User/Steward | Knowledge base articles with attachments |
| **glossary** | `/api/v1/glossary` | User/Steward | Business glossary terms and entity links |
| **governance** | `/api/v1/governance` | User/Steward | Classifications, approvals, permissions |
| **profiling** | `/api/v1/profiling` | User/Steward | Column profiling statistics |
| **comments** | `/api/v1/comments` | User | Entity-level threaded comments |
| **favorites** | `/api/v1/favorites` | User | Bookmark management |
| **notifications** | `/api/v1/notifications` | User | In-app notification system |
| **analytics** | `/api/v1/analytics` | User | View tracking and trending entities |
| **admin** | `/api/v1/admin` | Admin/Steward | User management, audit log, reindex |
| **webhooks** | `/api/v1/webhooks` | Steward | Webhook subscription management |
| **health** | `/health` | Public | Service health check |

### Service Layer

| Service | Responsibility |
|---------|---------------|
| **search_sync** | Synchronizes entity changes to Meilisearch indexes. Called after every create/update in the catalog. Requires explicit keyword args (`db_name`, `schema_name`, etc.) and eager-loaded relationships via SQLAlchemy `selectinload` before the session is committed. Supports individual sync and full reindex. |
| **audit** | Records all data mutations to the audit log with old/new data snapshots and actor information. |
| **notifications** | Creates in-app notifications for relevant events (comments, approvals, etc.). |
| **webhooks** | Dispatches webhook events to subscribed endpoints with HMAC-signed payloads. Tracks delivery status. |

### Data Model

```
DbConnection (1)
  │
  └─── Schema (many)
         │
         └─── Table (many)
                │
                ├─── Column (many)
                │      └─── ColumnProfile (0..1)
                │
                └─── TableLineage (many-to-many, via source/target names)

User (1)
  ├─── Comment (many)
  ├─── Favorite (many)
  ├─── Notification (many)
  ├─── Query (many, as creator)
  ├─── Article (many, as creator)
  ├─── GlossaryTerm (many, as creator/owner)
  ├─── ApprovalRequest (many, as requester/reviewer)
  ├─── DataClassification (many, as classifier)
  ├─── ResourcePermission (many)
  └─── AuditLog (many, as actor)

GlossaryTerm (1)
  └─── TermLink (many) → links to any entity

Article (1)
  └─── ArticleAttachment (many) → files in MinIO

Webhook (1)
  └─── WebhookEvent (many) → delivery history
```

**Soft Delete Pattern:** Most entities use a `deleted_at` timestamp instead of hard deletion. Queries filter `WHERE deleted_at IS NULL` by default.

### Database Migrations

Managed by Alembic with a linear revision chain:

| Revision | Description |
|----------|-------------|
| `0001` | Full initial schema (all tables, indexes, constraints) |
| `0002` | Add `title` column to the `columns` table |
| `0003` | Add `object_type` and `view_definition` to the `tables` table |
| `0004` | Add user groups, group memberships, and endorsements tables |
| `0005` | Add stewardship assignments table |

### Authentication Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────>│  OAuth       │────>│  Provider   │
│             │     │  /auth/login │     │  (Google /   │
│             │<────│  /callback   │<────│   Azure /   │
│             │     │              │     │   OIDC)     │
└──────┬──────┘     └──────┬───────┘     └─────────────┘
       │                   │
       │              JWT created
       │              (sub, role, jti)
       │                   │
       │   Authorization:  │
       │   Bearer <token>  │
       ▼                   ▼
┌──────────────────────────────────┐
│  Every subsequent API request    │
│  → decode JWT                    │
│  → check Redis blacklist (jti)   │
│  → load User from PostgreSQL     │
│  → enforce role requirements     │
└──────────────────────────────────┘
```

**OIDC Group Mapping:** When using a generic OIDC provider, group claims are automatically mapped to application roles:

- Members of the configured admin group → `admin` role
- Members of the configured steward group → `steward` role
- All others → `viewer` role

### Search Architecture

```
┌────────────────┐     sync on      ┌─────────────────┐
│   PostgreSQL   │ ──────────────>  │   Meilisearch   │
│                │  create/update   │                 │
│  Source of     │                  │  7 Indexes:     │
│  truth         │                  │  - databases    │
│                │                  │  - schemas      │
│                │  full reindex    │  - tables       │
│                │ ──────────────>  │  - columns      │
│                │  (admin trigger) │  - queries      │
│                │                  │  - articles     │
│                │                  │  - glossary     │
└────────────────┘                  └────────┬────────┘
                                             │
                                     search queries
                                             │
                                    ┌────────▼────────┐
                                    │   Frontend      │
                                    │   Search UI     │
                                    └─────────────────┘
```

Each index has configured:
- **Searchable attributes:** fields that are full-text searched (name, description, tags, etc.)
- **Filterable attributes:** fields available for filter queries (entity_type, schema_id, object_type, etc.)

## Frontend Architecture

### Application Structure

```
src/
├── api/                    # API client modules
│   ├── client.ts           # Axios instance with auth interceptor
│   ├── catalog.ts          # Database, schema, table, column APIs
│   ├── governance.ts       # Classifications, approvals, permissions
│   ├── social.ts           # Comments, favorites, notifications
│   ├── glossary.ts         # Glossary terms and links
│   ├── analytics.ts        # View tracking, popular/trending
│   ├── webhooks.ts         # Webhook management
│   └── ai.ts               # AI assistant (mock implementation)
│
├── auth/
│   └── AuthContext.tsx      # React context for auth state and role checks
│
├── hooks/                  # Custom React hooks
│   └── useEndorsement.ts   # Batched endorsement fetching with microtask coalescing
│
├── lib/                    # Shared library configuration
│   └── queryClient.ts      # TanStack Query client (staleTime, retry settings)
│
├── components/             # Reusable UI components
│   ├── Layout.tsx           # Main layout (sidebar + header + content)
│   ├── DatabaseTree.tsx     # Sidebar database/schema/table tree
│   ├── LineageView.tsx      # BFS lineage graph visualization
│   ├── CommentSection.tsx   # Threaded comments
│   ├── SearchAutocomplete.tsx # Global search with suggestions
│   ├── RichTextEditor.tsx   # TipTap WYSIWYG editor
│   ├── SqlEditor.tsx        # CodeMirror SQL editor
│   ├── InlineEdit.tsx       # Click-to-edit text fields
│   ├── TagEditor.tsx        # Multi-tag editor
│   └── ...                  # 15+ additional components
│
├── pages/                  # Route-level page components
│   ├── DashboardPage.tsx       # Home with stats, AI search, favorites
│   ├── DatabaseDetailPage.tsx  # Database detail — tabs: Schemas | Comments | Version History
│   ├── SchemaDetailPage.tsx    # Schema detail — tabs: Tables | Comments
│   ├── TableDetailPage.tsx     # Table/view detail — tabs: Columns | Lineage | Comments | History
│   ├── SearchPage.tsx          # Full search results page
│   ├── AdminPage.tsx           # User management and audit log
│   └── ...                     # 12+ additional pages
│
├── utils/                  # Utility functions
├── App.tsx                 # Route definitions
├── main.tsx                # Entry point
└── index.css               # TailwindCSS imports
```

### Routing

All routes except `/login` and `/auth/callback` are wrapped in an authenticated `Layout` component that provides the sidebar navigation, header search bar, and user menu.

### State Management

The application uses a combination of TanStack Query (React Query) for server state and React's built-in state for UI state:

- **TanStack Query** — server state caching, deduplication, and background refetching with a 2-minute stale time. Used on all detail pages and list pages for automatic cache-based instant back-navigation.
- **AuthContext** — global auth state (user, role, token) via React Context
- **Component-level state** — `useState` for local UI state (form inputs, modals, toggles)

### Performance Optimizations

- **Batch endorsement API** — endorsement badges collect requests within a single microtask tick and fire one `POST /endorsements/batch` instead of N individual GETs. A schema with 50 tables makes 1 request instead of 50.
- **Context endpoints** — `GET /tables/{id}/context` and `GET /columns/{id}/context` return the entity with its full breadcrumb hierarchy (schema + database) in a single query, eliminating 3–4 sequential waterfall fetches.
- **Code splitting** — all 16 page components are loaded on demand via `React.lazy` + `Suspense`, reducing the initial bundle size.
- **Stable column ordering** — `list_columns` applies `ORDER BY name` so column positions remain consistent after inline edits.

### API Client

All API calls go through a centralized Axios instance (`api/client.ts`) that:

- Attaches the JWT bearer token from localStorage to every request
- Handles 401 responses by redirecting to the login page
- Uses the backend base URL from environment configuration

Key API conventions:
- **Comment endpoints** use path params: `GET /api/v1/comments/{entity_type}/{entity_id}` and `POST /api/v1/comments/{entity_type}/{entity_id}`
- **Glossary term links** are returned inline in the `GET /api/v1/glossary/{id}` response (no separate endpoint needed)
- **Audit log** is accessible at `GET /api/v1/admin/audit`

## Deployment Architecture

### Docker Compose (Development/Single-Node)

All six services run as Docker containers orchestrated by Docker Compose:

- **Health checks** ensure services start in the correct order
- **Persistent volumes** preserve data across container restarts
- **Environment variables** are injected via `.env` file
- **Backend volume mount** (`./backend:/app`) enables hot-reload during development

### Production Considerations

| Concern | Recommendation |
|---------|---------------|
| **Backend scaling** | Stateless — run multiple instances behind a load balancer |
| **Frontend delivery** | Build static assets and serve from a CDN or Nginx |
| **Database HA** | PostgreSQL read replicas; connection pooling (PgBouncer) |
| **Search HA** | Meilisearch supports multi-node clustering |
| **Cache HA** | Redis Sentinel or Redis Cluster |
| **Object storage** | MinIO distributed mode or AWS S3 |
| **Secrets management** | Use a vault (HashiCorp Vault, AWS Secrets Manager) instead of .env |
| **TLS termination** | Reverse proxy (Nginx/Traefik) with TLS certificates |
| **Monitoring** | Structured logs (structlog) compatible with ELK/Datadog/Splunk |

### Security Design

- **JWT tokens** with configurable expiration and Redis-backed revocation
- **CORS** restricted to configured frontend origins
- **Rate limiting** on authentication endpoints (10 req/min)
- **HTML sanitization** (nh3) on all user-generated content (comments, articles)
- **API key authentication** for machine-to-machine ingestion
- **HMAC-signed webhooks** for secure event delivery
- **Bcrypt password hashing** for local authentication
- **Soft delete** pattern prevents accidental permanent data loss
