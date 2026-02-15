import uuid
from datetime import datetime

from pydantic import BaseModel


# ─── Comments ─────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    body: str


class CommentOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    user_id: uuid.UUID
    user_name: str | None = None
    body: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Favorites ────────────────────────────────────────────────────────────────

class FavoriteOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    entity_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FavoriteStatus(BaseModel):
    is_favorited: bool


# ─── Notifications ────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str | None
    entity_type: str | None
    entity_id: str | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCount(BaseModel):
    count: int
