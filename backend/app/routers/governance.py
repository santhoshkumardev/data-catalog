"""Governance — data classifications, approval workflows."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_steward
from app.database import get_db
from app.models.governance import ApprovalRequest, DataClassification, ResourcePermission
from app.models.user import User
from app.schemas.governance import (
    ApprovalCreate, ApprovalOut, ApprovalReview, ClassificationCreate, ClassificationOut,
    PaginatedApprovals, ResourcePermissionCreate, ResourcePermissionOut,
)
from app.services.audit import log_action

router = APIRouter(prefix="/api/v1/governance", tags=["governance"])


# ─── Classifications ─────────────────────────────────────────────────────────

@router.get("/classifications/{entity_type}/{entity_id}", response_model=ClassificationOut | None)
async def get_classification(
    entity_type: str, entity_id: str,
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    row = (await db.execute(
        select(DataClassification).where(DataClassification.entity_type == entity_type, DataClassification.entity_id == entity_id)
    )).scalar_one_or_none()
    if row is None:
        return None
    await db.refresh(row, ["classifier"])
    return ClassificationOut(
        id=row.id, entity_type=row.entity_type, entity_id=row.entity_id,
        level=row.level, reason=row.reason, classified_by=row.classified_by,
        classifier_name=row.classifier.name if row.classifier else None,
        created_at=row.created_at,
    )


@router.put("/classifications", response_model=ClassificationOut)
async def set_classification(
    payload: ClassificationCreate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    valid_levels = {"public", "internal", "confidential", "restricted"}
    if payload.level not in valid_levels:
        raise HTTPException(status_code=400, detail=f"Level must be one of {valid_levels}")
    existing = (await db.execute(
        select(DataClassification).where(DataClassification.entity_type == payload.entity_type, DataClassification.entity_id == payload.entity_id)
    )).scalar_one_or_none()
    if existing:
        existing.level = payload.level
        existing.reason = payload.reason
        existing.classified_by = current_user.id
        row = existing
    else:
        row = DataClassification(
            entity_type=payload.entity_type, entity_id=payload.entity_id,
            level=payload.level, reason=payload.reason, classified_by=current_user.id,
        )
        db.add(row)
    await log_action(db, "classification", payload.entity_id, "update", current_user.id, new_data={"level": payload.level})
    await db.commit()
    await db.refresh(row, ["classifier"])
    return ClassificationOut(
        id=row.id, entity_type=row.entity_type, entity_id=row.entity_id,
        level=row.level, reason=row.reason, classified_by=row.classified_by,
        classifier_name=row.classifier.name if row.classifier else None,
        created_at=row.created_at,
    )


# ─── Approvals ───────────────────────────────────────────────────────────────

@router.get("/approvals", response_model=PaginatedApprovals)
async def list_approvals(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    stmt = select(ApprovalRequest)
    count_stmt = select(func.count()).select_from(ApprovalRequest)
    if status_filter:
        stmt = stmt.where(ApprovalRequest.status == status_filter)
        count_stmt = count_stmt.where(ApprovalRequest.status == status_filter)
    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt.order_by(ApprovalRequest.created_at.desc()).offset((page - 1) * size).limit(size))).scalars().all()
    items = []
    for row in rows:
        await db.refresh(row, ["requester", "reviewer"])
        items.append(ApprovalOut(
            id=row.id, entity_type=row.entity_type, entity_id=row.entity_id,
            action=row.action, requested_by=row.requested_by,
            requester_name=row.requester.name if row.requester else None,
            reviewer_id=row.reviewer_id,
            reviewer_name=row.reviewer.name if row.reviewer else None,
            status=row.status, proposed_changes=row.proposed_changes,
            review_comment=row.review_comment, created_at=row.created_at,
            reviewed_at=row.reviewed_at,
        ))
    return PaginatedApprovals(total=total, page=page, size=size, items=items)


@router.post("/approvals", response_model=ApprovalOut, status_code=201)
async def create_approval(
    payload: ApprovalCreate, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = ApprovalRequest(
        entity_type=payload.entity_type, entity_id=payload.entity_id,
        action=payload.action, requested_by=current_user.id,
        proposed_changes=payload.proposed_changes,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req, ["requester", "reviewer"])
    return ApprovalOut(
        id=req.id, entity_type=req.entity_type, entity_id=req.entity_id,
        action=req.action, requested_by=req.requested_by,
        requester_name=req.requester.name, reviewer_id=None,
        status=req.status, proposed_changes=req.proposed_changes,
        review_comment=None, created_at=req.created_at, reviewed_at=None,
    )


@router.post("/approvals/{approval_id}/review", response_model=ApprovalOut)
async def review_approval(
    approval_id: uuid.UUID, review: ApprovalReview,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    req = (await db.execute(select(ApprovalRequest).where(ApprovalRequest.id == approval_id))).scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Already reviewed")
    if review.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    req.status = review.status
    req.reviewer_id = current_user.id
    req.review_comment = review.review_comment
    req.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(req, ["requester", "reviewer"])
    return ApprovalOut(
        id=req.id, entity_type=req.entity_type, entity_id=req.entity_id,
        action=req.action, requested_by=req.requested_by,
        requester_name=req.requester.name if req.requester else None,
        reviewer_id=req.reviewer_id,
        reviewer_name=req.reviewer.name if req.reviewer else None,
        status=req.status, proposed_changes=req.proposed_changes,
        review_comment=req.review_comment, created_at=req.created_at,
        reviewed_at=req.reviewed_at,
    )


# ─── Resource Permissions ────────────────────────────────────────────────────

@router.get("/permissions/{entity_type}/{entity_id}", response_model=list[ResourcePermissionOut])
async def list_permissions(
    entity_type: str, entity_id: str,
    db: AsyncSession = Depends(get_db), _: User = Depends(require_steward),
):
    rows = (await db.execute(
        select(ResourcePermission).where(ResourcePermission.entity_type == entity_type, ResourcePermission.entity_id == entity_id)
    )).scalars().all()
    items = []
    for row in rows:
        await db.refresh(row, ["user", "granter"])
        items.append(ResourcePermissionOut(
            id=row.id, user_id=row.user_id, user_name=row.user.name if row.user else None,
            entity_type=row.entity_type, entity_id=row.entity_id, role=row.role,
            granted_by=row.granted_by, created_at=row.created_at,
        ))
    return items


@router.post("/permissions", response_model=ResourcePermissionOut, status_code=201)
async def grant_permission(
    payload: ResourcePermissionCreate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    perm = ResourcePermission(
        user_id=payload.user_id, entity_type=payload.entity_type,
        entity_id=payload.entity_id, role=payload.role,
        granted_by=current_user.id,
    )
    db.add(perm)
    await db.commit()
    await db.refresh(perm, ["user", "granter"])
    return ResourcePermissionOut(
        id=perm.id, user_id=perm.user_id, user_name=perm.user.name if perm.user else None,
        entity_type=perm.entity_type, entity_id=perm.entity_id, role=perm.role,
        granted_by=perm.granted_by, created_at=perm.created_at,
    )


@router.delete("/permissions/{perm_id}", status_code=204)
async def revoke_permission(
    perm_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    _: User = Depends(require_steward),
):
    perm = (await db.execute(select(ResourcePermission).where(ResourcePermission.id == perm_id))).scalar_one_or_none()
    if perm is None:
        raise HTTPException(status_code=404, detail="Permission not found")
    await db.delete(perm)
    await db.commit()
