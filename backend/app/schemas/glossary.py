import uuid
from datetime import datetime

from pydantic import BaseModel


class GlossaryTermCreate(BaseModel):
    name: str
    definition: str
    tags: list[str] | None = None
    status: str = "draft"


class GlossaryTermPatch(BaseModel):
    name: str | None = None
    definition: str | None = None
    tags: list[str] | None = None
    status: str | None = None


class TermLinkOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GlossaryTermOut(BaseModel):
    id: uuid.UUID
    name: str
    definition: str
    owner_id: uuid.UUID | None
    owner_name: str | None = None
    tags: list[str] | None
    status: str
    created_by: uuid.UUID | None
    creator_name: str | None = None
    created_at: datetime
    updated_at: datetime
    links: list[TermLinkOut] = []

    model_config = {"from_attributes": True}


class PaginatedGlossaryTerms(BaseModel):
    total: int
    page: int
    size: int
    items: list[GlossaryTermOut]


class TermLinkCreate(BaseModel):
    entity_type: str
    entity_id: str
