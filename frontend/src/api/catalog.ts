import api from "./client";

export interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  description?: string;
  tags?: string[];
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Schema {
  id: string;
  connection_id: string;
  name: string;
  description?: string;
  tags?: string[];
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Table {
  id: string;
  schema_id: string;
  name: string;
  description?: string;
  tags?: string[];
  sme_name?: string;
  sme_email?: string;
  row_count?: number;
  object_type?: string;
  view_definition?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: string;
  table_id: string;
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  title?: string;
  description?: string;
  tags?: string[];
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BreadcrumbContext {
  database: DbConnection;
  schema_obj: Schema;
}

export interface TableWithContext extends Table {
  context: BreadcrumbContext;
}

export interface ColumnWithContext extends Column {
  context: BreadcrumbContext;
  table: Table;
}

export interface Paginated<T> {
  total: number;
  page: number;
  size: number;
  items: T[];
}

export interface SearchResult {
  id: string;
  entity_type: string;
  name: string;
  description?: string;
  tags?: string[];
  breadcrumb: string[];
  rank: number;
  parent_id?: string;
  connection_id?: string;
  schema_id?: string;
}

export interface SearchResponse {
  total: number;
  page: number;
  size: number;
  results: SearchResult[];
}

export interface Stats {
  databases: number;
  schemas: number;
  tables: number;
  columns: number;
  queries: number;
}

// Databases
export const getDatabases = (page = 1, size = 20) =>
  api.get<Paginated<DbConnection>>("/api/v1/databases", { params: { page, size } }).then((r) => r.data);

export const getDatabase = (id: string) =>
  api.get<DbConnection>(`/api/v1/databases/${id}`).then((r) => r.data);

export const patchDatabase = (id: string, data: { description?: string; tags?: string[] }) =>
  api.patch<DbConnection>(`/api/v1/databases/${id}`, data).then((r) => r.data);

// Schemas
export const getSchemas = (dbId: string, page = 1, size = 20, include_deleted = false) =>
  api.get<Paginated<Schema>>(`/api/v1/databases/${dbId}/schemas`, { params: { page, size, include_deleted } }).then((r) => r.data);

export const getSchema = (id: string) =>
  api.get<Schema>(`/api/v1/schemas/${id}`).then((r) => r.data);

export const patchSchema = (id: string, data: { description?: string; tags?: string[] }) =>
  api.patch<Schema>(`/api/v1/schemas/${id}`, data).then((r) => r.data);

// Tables
export const getTables = (schemaId: string, page = 1, size = 20, include_deleted = false) =>
  api.get<Paginated<Table>>(`/api/v1/schemas/${schemaId}/tables`, { params: { page, size, include_deleted } }).then((r) => r.data);

export const getTable = (id: string) =>
  api.get<Table>(`/api/v1/tables/${id}`).then((r) => r.data);

export const patchTable = (
  id: string,
  data: { description?: string; tags?: string[]; sme_name?: string; sme_email?: string }
) => api.patch<Table>(`/api/v1/tables/${id}`, data).then((r) => r.data);

// Columns
export const getColumns = (tableId: string, page = 1, size = 100) =>
  api.get<Paginated<Column>>(`/api/v1/tables/${tableId}/columns`, { params: { page, size } }).then((r) => r.data);

export const getColumn = (id: string) =>
  api.get<Column>(`/api/v1/columns/${id}`).then((r) => r.data);

export const patchColumn = (id: string, data: { description?: string; tags?: string[]; title?: string }) =>
  api.patch<Column>(`/api/v1/columns/${id}`, data).then((r) => r.data);

// Context (single-request breadcrumb fetching)
export const getTableContext = (id: string) =>
  api.get<TableWithContext>(`/api/v1/tables/${id}/context`).then((r) => r.data);

export const getColumnContext = (id: string) =>
  api.get<ColumnWithContext>(`/api/v1/columns/${id}/context`).then((r) => r.data);

// Search (Meilisearch-backed)
export const search = (q: string, type = "all", page = 1, size = 20) =>
  api.get<SearchResponse>("/api/v1/search", { params: { q, type, page, size } }).then((r) => r.data);

// Stats
export const getStats = () =>
  api.get<Stats>("/api/v1/stats").then((r) => r.data);

// Queries
export interface QueryDoc {
  id: string;
  name: string;
  description?: string;
  connection_id?: string;
  database_name?: string;
  sme_name?: string;
  sme_email?: string;
  sql_text: string;
  created_by?: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

export interface QueryCreate {
  name: string;
  description?: string;
  connection_id?: string;
  sme_name?: string;
  sme_email?: string;
  sql_text: string;
}

export const getQueries = (page = 1, size = 20, db_id?: string) =>
  api.get<Paginated<QueryDoc>>("/api/v1/queries", { params: { page, size, ...(db_id ? { db_id } : {}) } }).then((r) => r.data);

export const getQuery = (id: string) =>
  api.get<QueryDoc>(`/api/v1/queries/${id}`).then((r) => r.data);

export const createQuery = (data: QueryCreate) =>
  api.post<QueryDoc>("/api/v1/queries", data).then((r) => r.data);

export const patchQuery = (id: string, data: Partial<QueryCreate>) =>
  api.patch<QueryDoc>(`/api/v1/queries/${id}`, data).then((r) => r.data);

export const deleteQuery = (id: string) =>
  api.delete(`/api/v1/queries/${id}`);

// Lineage
export interface LineageNode {
  db_name: string;
  table_name: string;
  is_catalog_table: boolean;
  table_id?: string;
  edge_id?: string;
  has_annotation?: boolean;
  has_more_upstream: boolean;
  has_more_downstream: boolean;
  children: LineageNode[];
}

export interface EdgeAnnotation {
  integration_description?: string | null;
  integration_method?: string | null;
  integration_schedule?: string | null;
  integration_notes?: string | null;
  integration_updated_by?: string | null;
  integration_updated_at?: string | null;
}

export interface EdgeAnnotationUpdate {
  integration_description?: string | null;
  integration_method?: string | null;
  integration_schedule?: string | null;
  integration_notes?: string | null;
}

export interface LineageGraph {
  upstream: LineageNode[];
  downstream: LineageNode[];
  current_db: string;
  current_table: string;
}

export interface LineageEdgeCreate {
  source_db_name: string;
  source_table_name: string;
  target_db_name: string;
  target_table_name: string;
}

export interface LineageTableSearchResult {
  db_name: string;
  table_name: string;
  table_id: string;
}

export const getTableLineage = (tableId: string, levels = 1) =>
  api.get<LineageGraph>(`/api/v1/tables/${tableId}/lineage`, { params: { levels } }).then((r) => r.data);

export const deleteLineageEdge = (id: string) =>
  api.delete(`/api/v1/lineage/${id}`);

export const createLineageEdge = (data: LineageEdgeCreate) =>
  api.post("/api/v1/lineage", data).then((r) => r.data);

export const searchTablesForLineage = (q: string, limit = 10) =>
  api.get<LineageTableSearchResult[]>("/api/v1/lineage/search-tables", { params: { q, limit } }).then((r) => r.data);

export const expandLineageNode = (dbName: string, tableName: string, direction: "upstream" | "downstream", levels = 1) =>
  api.get<LineageNode[]>("/api/v1/lineage/expand", { params: { db_name: dbName, table_name: tableName, direction, levels } }).then((r) => r.data);

export const getEdgeAnnotation = (edgeId: string) =>
  api.get<EdgeAnnotation>(`/api/v1/lineage/${edgeId}/annotation`).then((r) => r.data);

export const updateEdgeAnnotation = (edgeId: string, data: EdgeAnnotationUpdate) =>
  api.put<EdgeAnnotation>(`/api/v1/lineage/${edgeId}/annotation`, data).then((r) => r.data);

// Articles
export interface AttachmentMeta {
  id: string;
  article_id: string;
  filename: string;
  content_type?: string;
  file_size?: number;
  s3_key?: string;
  download_url?: string;
  created_at: string;
}

export interface ArticleDoc {
  id: string;
  title: string;
  description?: string;
  sme_name?: string;
  sme_email?: string;
  body?: string;
  tags?: string[];
  created_by?: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
  attachments: AttachmentMeta[];
}

export const getArticles = (page = 1, size = 20) =>
  api.get<Paginated<ArticleDoc>>("/api/v1/articles", { params: { page, size } }).then((r) => r.data);

export const getArticle = (id: string) =>
  api.get<ArticleDoc>(`/api/v1/articles/${id}`).then((r) => r.data);

export const createArticle = (data: Partial<ArticleDoc>) =>
  api.post<ArticleDoc>("/api/v1/articles", data).then((r) => r.data);

export const patchArticle = (id: string, data: Partial<ArticleDoc>) =>
  api.patch<ArticleDoc>(`/api/v1/articles/${id}`, data).then((r) => r.data);

export const deleteArticle = (id: string) =>
  api.delete(`/api/v1/articles/${id}`);

export const uploadAttachment = (articleId: string, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post<AttachmentMeta>(`/api/v1/articles/${articleId}/attachments`, fd).then((r) => r.data);
};

export const deleteAttachment = (articleId: string, attId: string) =>
  api.delete(`/api/v1/articles/${articleId}/attachments/${attId}`);

// Admin
export const getUsers = () =>
  api.get<{ id: string; email: string; name: string; role: string }[]>("/api/v1/admin/users").then((r) => r.data);

export const updateUserRole = (userId: string, role: string) =>
  api.patch(`/api/v1/admin/users/${userId}/role`, { role }).then((r) => r.data);

// Query Runner
export interface QueryRunResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  truncated: boolean;
}

export const executeQuery = (sql: string, max_rows = 100) =>
  api.post<QueryRunResult>("/api/v1/query-runner/execute", { sql, max_rows }).then((r) => r.data);

// Groups
export interface GroupDoc {
  id: string;
  name: string;
  ad_group_name?: string;
  app_role: string;
  description?: string;
  member_count: number;
  created_at: string;
}

export interface GroupMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  synced_at: string;
}

export const getGroups = () =>
  api.get<GroupDoc[]>("/api/v1/admin/groups").then((r) => r.data);

export const createGroup = (data: { name: string; ad_group_name?: string; app_role: string; description?: string }) =>
  api.post<GroupDoc>("/api/v1/admin/groups", data).then((r) => r.data);

export const patchGroup = (id: string, data: { name?: string; ad_group_name?: string; app_role?: string; description?: string }) =>
  api.patch<GroupDoc>(`/api/v1/admin/groups/${id}`, data).then((r) => r.data);

export const deleteGroup = (id: string) =>
  api.delete(`/api/v1/admin/groups/${id}`);

export const getGroupMembers = (groupId: string) =>
  api.get<GroupMember[]>(`/api/v1/admin/groups/${groupId}/members`).then((r) => r.data);

export const addGroupMember = (groupId: string, userId: string) =>
  api.post<GroupMember>(`/api/v1/admin/groups/${groupId}/members`, { user_id: userId }).then((r) => r.data);

export const removeGroupMember = (groupId: string, userId: string) =>
  api.delete(`/api/v1/admin/groups/${groupId}/members/${userId}`);

// Audit Log
export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id?: string;
  actor_name?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  request_id?: string;
  created_at: string;
}

export const getAuditLog = (page = 1, size = 20, entity_type?: string, entity_id?: string) =>
  api.get<Paginated<AuditLogEntry>>("/api/v1/admin/audit", {
    params: { page, size, ...(entity_type ? { entity_type } : {}), ...(entity_id ? { entity_id } : {}) },
  }).then((r) => r.data);
