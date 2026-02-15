import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    action: str
    actor_id: uuid.UUID | None
    actor_name: str | None = None
    old_data: dict | None
    new_data: dict | None
    request_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAuditLogs(BaseModel):
    total: int
    page: int
    size: int
    items: list[AuditLogOut]
