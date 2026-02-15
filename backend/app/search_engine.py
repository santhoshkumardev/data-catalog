import meilisearch

from app.config import settings

_client: meilisearch.Client | None = None

INDEXES = ["databases", "schemas", "tables", "columns", "queries", "articles", "glossary"]

# Mapping from index name to singular entity type
_INDEX_TO_ENTITY = {
    "databases": "database",
    "schemas": "schema",
    "tables": "table",
    "columns": "column",
    "queries": "query",
    "articles": "article",
    "glossary": "glossary",
}

SEARCHABLE_ATTRS = {
    "databases": ["name", "description", "tags"],
    "schemas": ["name", "description", "tags"],
    "tables": ["name", "description", "tags", "sme_name"],
    "columns": ["name", "description", "data_type", "tags"],
    "queries": ["name", "description", "sme_name", "sql_text"],
    "articles": ["title", "description", "sme_name", "body", "tags"],
    "glossary": ["name", "definition", "tags"],
}

FILTERABLE_ATTRS = {
    "databases": ["entity_type"],
    "schemas": ["entity_type", "connection_id"],
    "tables": ["entity_type", "schema_id", "object_type"],
    "columns": ["entity_type", "table_id"],
    "queries": ["entity_type", "connection_id"],
    "articles": ["entity_type"],
    "glossary": ["entity_type", "status"],
}


def get_client() -> meilisearch.Client:
    global _client
    if _client is None:
        _client = meilisearch.Client(settings.meilisearch_url, settings.meilisearch_api_key)
    return _client


def init_indexes() -> None:
    client = get_client()
    for idx in INDEXES:
        try:
            client.create_index(idx, {"primaryKey": "id"})
        except Exception:
            pass
        index = client.index(idx)
        if idx in SEARCHABLE_ATTRS:
            index.update_searchable_attributes(SEARCHABLE_ATTRS[idx])
        if idx in FILTERABLE_ATTRS:
            index.update_filterable_attributes(FILTERABLE_ATTRS[idx])


def index_document(index_name: str, doc: dict) -> None:
    client = get_client()
    doc["entity_type"] = _INDEX_TO_ENTITY.get(index_name, index_name)
    client.index(index_name).add_documents([doc])


def index_documents(index_name: str, docs: list[dict]) -> None:
    if not docs:
        return
    client = get_client()
    entity_type = _INDEX_TO_ENTITY.get(index_name, index_name)
    for d in docs:
        d["entity_type"] = entity_type
    client.index(index_name).add_documents(docs)


def delete_document(index_name: str, doc_id: str) -> None:
    client = get_client()
    client.index(index_name).delete_document(doc_id)


def search_index(index_name: str, query: str, limit: int = 20, offset: int = 0, filter_str: str | None = None) -> dict:
    client = get_client()
    params = {"limit": limit, "offset": offset}
    if filter_str:
        params["filter"] = filter_str
    return client.index(index_name).search(query, params)


def multi_search(query: str, indexes: list[str] | None = None, limit: int = 20, offset: int = 0) -> dict:
    client = get_client()
    target_indexes = indexes or INDEXES
    queries = [{"indexUid": idx, "q": query, "limit": limit, "offset": offset} for idx in target_indexes]
    return client.multi_search(queries)
