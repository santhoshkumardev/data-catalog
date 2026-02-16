import uuid
from datetime import datetime

from pydantic import BaseModel


# ─── Column ──────────────────────────────────────────────────────────────────

class ColumnBase(BaseModel):
    name: str
    data_type: str
    is_nullable: bool = True
    is_primary_key: bool = False
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None


class ColumnCreate(ColumnBase):
    pass


class ColumnPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None


class ColumnOut(ColumnBase):
    id: uuid.UUID
    table_id: uuid.UUID
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Table ───────────────────────────────────────────────────────────────────

class TableBase(BaseModel):
    name: str
    description: str | None = None
    tags: list[str] | None = None
    sme_name: str | None = None
    sme_email: str | None = None
    row_count: int | None = None
    object_type: str = "table"
    view_definition: str | None = None


class TableCreate(TableBase):
    pass


class TablePatch(BaseModel):
    description: str | None = None
    tags: list[str] | None = None
    sme_name: str | None = None
    sme_email: str | None = None


class TableOut(TableBase):
    id: uuid.UUID
    schema_id: uuid.UUID
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Schema ──────────────────────────────────────────────────────────────────

class SchemaBase(BaseModel):
    name: str
    description: str | None = None
    tags: list[str] | None = None


class SchemaCreate(SchemaBase):
    pass


class SchemaPatch(BaseModel):
    description: str | None = None
    tags: list[str] | None = None


class SchemaOut(SchemaBase):
    id: uuid.UUID
    connection_id: uuid.UUID
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── DbConnection ─────────────────────────────────────────────────────────────

class DbConnectionBase(BaseModel):
    name: str
    db_type: str
    description: str | None = None
    tags: list[str] | None = None


class DbConnectionCreate(DbConnectionBase):
    pass


class DbConnectionPatch(BaseModel):
    description: str | None = None
    tags: list[str] | None = None


class DbConnectionOut(DbConnectionBase):
    id: uuid.UUID
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Context (waterfall elimination) ────────────────────────────────────────

class BreadcrumbContext(BaseModel):
    database: DbConnectionOut
    schema_obj: SchemaOut

    model_config = {"from_attributes": True}


class TableWithContext(TableOut):
    context: BreadcrumbContext


class ColumnWithContext(ColumnOut):
    context: BreadcrumbContext
    table: TableOut


# ─── Ingest payload ──────────────────────────────────────────────────────────

class IngestColumn(BaseModel):
    name: str
    data_type: str
    is_nullable: bool = True
    is_primary_key: bool = False


class IngestTable(BaseModel):
    name: str
    row_count: int | None = None
    object_type: str = "table"
    view_definition: str | None = None
    columns: list[IngestColumn] = []


class IngestSchema(BaseModel):
    name: str
    tables: list[IngestTable] = []


class IngestBatchPayload(BaseModel):
    database: DbConnectionCreate
    schemas: list[IngestSchema] = []
    mark_missing_as_deleted: bool = False


class IngestBatchResult(BaseModel):
    database_id: uuid.UUID
    schemas_upserted: int
    tables_upserted: int
    columns_upserted: int


# ─── Search ──────────────────────────────────────────────────────────────────

class SearchResult(BaseModel):
    id: str
    entity_type: str
    name: str
    description: str | None = None
    tags: list[str] | None = None
    breadcrumb: list[str] = []
    rank: float = 0.0
    parent_id: str | None = None
    connection_id: str | None = None
    schema_id: str | None = None


class SearchResponse(BaseModel):
    total: int
    page: int
    size: int
    results: list[SearchResult]


# ─── Query ───────────────────────────────────────────────────────────────────

class QueryCreate(BaseModel):
    name: str
    description: str | None = None
    connection_id: uuid.UUID | None = None
    sme_name: str | None = None
    sme_email: str | None = None
    sql_text: str


class QueryPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    connection_id: uuid.UUID | None = None
    sme_name: str | None = None
    sme_email: str | None = None
    sql_text: str | None = None


class QueryOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    connection_id: uuid.UUID | None
    database_name: str | None = None
    sme_name: str | None
    sme_email: str | None
    sql_text: str
    created_by: uuid.UUID | None
    creator_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedQueries(BaseModel):
    total: int
    page: int
    size: int
    items: list[QueryOut]


# ─── Article ─────────────────────────────────────────────────────────────────

class ArticleCreate(BaseModel):
    title: str
    description: str | None = None
    sme_name: str | None = None
    sme_email: str | None = None
    body: str | None = None
    tags: list[str] | None = None


class ArticlePatch(BaseModel):
    title: str | None = None
    description: str | None = None
    sme_name: str | None = None
    sme_email: str | None = None
    body: str | None = None
    tags: list[str] | None = None


class AttachmentOut(BaseModel):
    id: uuid.UUID
    article_id: uuid.UUID
    filename: str
    content_type: str | None
    file_size: int | None
    s3_key: str
    download_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    sme_name: str | None
    sme_email: str | None
    body: str | None
    tags: list[str] | None
    created_by: uuid.UUID | None
    creator_name: str | None = None
    created_at: datetime
    updated_at: datetime
    attachments: list[AttachmentOut] = []

    model_config = {"from_attributes": True}


class PaginatedArticles(BaseModel):
    total: int
    page: int
    size: int
    items: list[ArticleOut]


# ─── Lineage ─────────────────────────────────────────────────────────────────

class LineageEdgeCreate(BaseModel):
    source_db_name: str
    source_table_name: str
    target_db_name: str
    target_table_name: str


class LineageEdgeOut(BaseModel):
    id: uuid.UUID
    source_db_name: str
    source_table_name: str
    target_db_name: str
    target_table_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LineageNode(BaseModel):
    db_name: str
    table_name: str
    is_catalog_table: bool
    table_id: uuid.UUID | None = None
    edge_id: uuid.UUID | None = None
    has_annotation: bool = False
    has_more_upstream: bool = False
    has_more_downstream: bool = False
    children: list["LineageNode"] = []


LineageNode.model_rebuild()


class EdgeAnnotationOut(BaseModel):
    integration_description: str | None = None
    integration_method: str | None = None
    integration_schedule: str | None = None
    integration_notes: str | None = None
    integration_updated_by: uuid.UUID | None = None
    integration_updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class EdgeAnnotationUpdate(BaseModel):
    integration_description: str | None = None
    integration_method: str | None = None
    integration_schedule: str | None = None
    integration_notes: str | None = None


class LineageTableSearchResult(BaseModel):
    db_name: str
    table_name: str
    table_id: uuid.UUID


class LineageGraph(BaseModel):
    upstream: list[LineageNode]
    downstream: list[LineageNode]
    current_db: str
    current_table: str


# ─── Pagination ──────────────────────────────────────────────────────────────

class PaginatedDbConnections(BaseModel):
    total: int
    page: int
    size: int
    items: list[DbConnectionOut]


class PaginatedSchemas(BaseModel):
    total: int
    page: int
    size: int
    items: list[SchemaOut]


class PaginatedTables(BaseModel):
    total: int
    page: int
    size: int
    items: list[TableOut]


class PaginatedColumns(BaseModel):
    total: int
    page: int
    size: int
    items: list[ColumnOut]
