import uuid
from datetime import datetime

from pydantic import BaseModel


# ─── Classification ──────────────────────────────────────────────────────────

class ClassificationCreate(BaseModel):
    entity_type: str
    entity_id: str
    level: str  # public, internal, confidential, restricted
    reason: str | None = None


class ClassificationOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    level: str
    reason: str | None
    classified_by: uuid.UUID | None
    classifier_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Approval ────────────────────────────────────────────────────────────────

class ApprovalCreate(BaseModel):
    entity_type: str
    entity_id: str
    action: str
    proposed_changes: dict | None = None


class ApprovalReview(BaseModel):
    status: str  # approved, rejected
    review_comment: str | None = None


class ApprovalOut(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    action: str
    requested_by: uuid.UUID
    requester_name: str | None = None
    reviewer_id: uuid.UUID | None
    reviewer_name: str | None = None
    status: str
    proposed_changes: dict | None
    review_comment: str | None
    created_at: datetime
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


class PaginatedApprovals(BaseModel):
    total: int
    page: int
    size: int
    items: list[ApprovalOut]


# ─── Resource Permissions ────────────────────────────────────────────────────

class ResourcePermissionCreate(BaseModel):
    user_id: uuid.UUID
    entity_type: str
    entity_id: str
    role: str


class ResourcePermissionOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    entity_type: str
    entity_id: str
    role: str
    granted_by: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Column Profiling ────────────────────────────────────────────────────────

class ColumnProfileCreate(BaseModel):
    null_percentage: float | None = None
    distinct_count: int | None = None
    min_value: str | None = None
    max_value: str | None = None
    avg_length: float | None = None
    sample_values: list[str] | None = None


class ColumnProfileOut(BaseModel):
    id: uuid.UUID
    column_id: uuid.UUID
    null_percentage: float | None
    distinct_count: int | None
    min_value: str | None
    max_value: str | None
    avg_length: float | None
    sample_values: list[str] | None
    profiled_at: datetime | None
    profiled_by: uuid.UUID | None

    model_config = {"from_attributes": True}
