import uuid
from datetime import datetime

from pydantic import BaseModel


class WebhookCreate(BaseModel):
    name: str
    url: str
    secret: str | None = None
    events: list[str] | None = None
    is_active: bool = True


class WebhookPatch(BaseModel):
    name: str | None = None
    url: str | None = None
    secret: str | None = None
    events: list[str] | None = None
    is_active: bool | None = None


class WebhookOut(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    events: list[str] | None
    is_active: bool
    created_by: uuid.UUID | None
    creator_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WebhookEventOut(BaseModel):
    id: uuid.UUID
    webhook_id: uuid.UUID
    event_type: str
    payload: dict | None
    status_code: int | None
    response_body: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedWebhookEvents(BaseModel):
    total: int
    page: int
    size: int
    items: list[WebhookEventOut]
