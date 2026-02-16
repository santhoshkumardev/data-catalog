import uuid
from datetime import datetime

from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    ad_group_name: str | None = None
    app_role: str  # admin, steward, viewer
    description: str | None = None


class GroupPatch(BaseModel):
    name: str | None = None
    ad_group_name: str | None = None
    app_role: str | None = None
    description: str | None = None


class GroupOut(BaseModel):
    id: uuid.UUID
    name: str
    ad_group_name: str | None
    app_role: str
    description: str | None
    member_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class UserGroupOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_email: str
    synced_at: datetime

    model_config = {"from_attributes": True}


class AddMember(BaseModel):
    user_id: uuid.UUID
