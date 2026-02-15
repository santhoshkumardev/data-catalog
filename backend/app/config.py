from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://catalog:catalogpass@localhost:5433/datacatalog"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    google_client_id: str = ""
    google_client_secret: str = ""

    azure_client_id: str = ""
    azure_client_secret: str = ""
    azure_tenant_id: str = ""

    # Generic OIDC
    oidc_issuer_url: str = ""
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    oidc_groups_claim: str = "groups"

    # AD group → role mapping
    oidc_admin_group: str = ""
    oidc_steward_group: str = ""

    ingest_api_key: str = "dev-ingest-key"

    app_base_url: str = "http://localhost:8001"
    frontend_url: str = "http://localhost:3001"

    redis_url: str = "redis://localhost:6379/0"

    meilisearch_url: str = "http://localhost:7700"
    meilisearch_api_key: str = "dev-meili-master-key"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "data-catalog"
    minio_use_ssl: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
