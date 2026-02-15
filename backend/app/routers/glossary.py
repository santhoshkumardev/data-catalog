"""Business glossary — CRUD terms, link/unlink to entities."""
import uuid

import nh3
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_steward
from app.database import get_db
from app.models.glossary import GlossaryTerm, TermLink
from app.models.user import User
from app.schemas.glossary import (
    GlossaryTermCreate, GlossaryTermOut, GlossaryTermPatch,
    PaginatedGlossaryTerms, TermLinkCreate, TermLinkOut,
)
from app.services.audit import log_action
from app.services.search_sync import sync_glossary_term, remove_document

router = APIRouter(prefix="/api/v1/glossary", tags=["glossary"])


def _to_out(t: GlossaryTerm) -> GlossaryTermOut:
    return GlossaryTermOut(
        id=t.id, name=t.name, definition=t.definition,
        owner_id=t.owner_id, owner_name=t.owner.name if t.owner else None,
        tags=t.tags, status=t.status, created_by=t.created_by,
        creator_name=t.creator.name if t.creator else None,
        created_at=t.created_at, updated_at=t.updated_at,
        links=[TermLinkOut(id=l.id, entity_type=l.entity_type, entity_id=l.entity_id, created_at=l.created_at) for l in t.links],
    )


@router.get("", response_model=PaginatedGlossaryTerms)
async def list_terms(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    stmt = select(GlossaryTerm).where(GlossaryTerm.deleted_at.is_(None))
    count_stmt = select(func.count()).select_from(GlossaryTerm).where(GlossaryTerm.deleted_at.is_(None))
    if q:
        like_q = f"%{q}%"
        stmt = stmt.where(GlossaryTerm.name.ilike(like_q) | GlossaryTerm.definition.ilike(like_q))
        count_stmt = count_stmt.where(GlossaryTerm.name.ilike(like_q) | GlossaryTerm.definition.ilike(like_q))
    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt.order_by(GlossaryTerm.name).offset((page - 1) * size).limit(size))).scalars().all()
    items = []
    for row in rows:
        await db.refresh(row, ["owner", "creator", "links"])
        items.append(_to_out(row))
    return PaginatedGlossaryTerms(total=total, page=page, size=size, items=items)


@router.post("", response_model=GlossaryTermOut, status_code=201)
async def create_term(
    payload: GlossaryTermCreate, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_steward),
):
    definition = nh3.clean(payload.definition) if payload.definition else payload.definition
    term = GlossaryTerm(
        name=payload.name, definition=definition, tags=payload.tags,
        status=payload.status, owner_id=current_user.id, created_by=current_user.id,
    )
    db.add(term)
    await log_action(db, "glossary_term", str(term.id), "create", current_user.id, new_data={"name": term.name})
    await db.commit()
    await db.refresh(term, ["owner", "creator", "links"])
    sync_glossary_term(term)
    return _to_out(term)


@router.get("/{term_id}", response_model=GlossaryTermOut)
async def get_term(term_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    term = (await db.execute(select(GlossaryTerm).where(GlossaryTerm.id == term_id, GlossaryTerm.deleted_at.is_(None)))).scalar_one_or_none()
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    await db.refresh(term, ["owner", "creator", "links"])
    return _to_out(term)


@router.patch("/{term_id}", response_model=GlossaryTermOut)
async def patch_term(
    term_id: uuid.UUID, patch: GlossaryTermPatch,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    term = (await db.execute(select(GlossaryTerm).where(GlossaryTerm.id == term_id, GlossaryTerm.deleted_at.is_(None)))).scalar_one_or_none()
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    changes = patch.model_dump(exclude_unset=True)
    if "definition" in changes and changes["definition"]:
        changes["definition"] = nh3.clean(changes["definition"])
    old_data = {"name": term.name, "definition": term.definition}
    for field, value in changes.items():
        setattr(term, field, value)
    await log_action(db, "glossary_term", str(term_id), "update", current_user.id, old_data, changes)
    await db.commit()
    await db.refresh(term, ["owner", "creator", "links"])
    sync_glossary_term(term)
    return _to_out(term)


@router.delete("/{term_id}", status_code=204)
async def delete_term(
    term_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_steward),
):
    from datetime import datetime, timezone
    term = (await db.execute(select(GlossaryTerm).where(GlossaryTerm.id == term_id, GlossaryTerm.deleted_at.is_(None)))).scalar_one_or_none()
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    term.deleted_at = datetime.now(timezone.utc)
    await log_action(db, "glossary_term", str(term_id), "delete", current_user.id, old_data={"name": term.name})
    await db.commit()
    remove_document("glossary", str(term_id))


@router.post("/{term_id}/links", response_model=TermLinkOut, status_code=201)
async def link_entity(
    term_id: uuid.UUID, payload: TermLinkCreate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    term = (await db.execute(select(GlossaryTerm).where(GlossaryTerm.id == term_id, GlossaryTerm.deleted_at.is_(None)))).scalar_one_or_none()
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    link = TermLink(term_id=term_id, entity_type=payload.entity_type, entity_id=payload.entity_id, created_by=current_user.id)
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return TermLinkOut(id=link.id, entity_type=link.entity_type, entity_id=link.entity_id, created_at=link.created_at)


@router.delete("/{term_id}/links/{link_id}", status_code=204)
async def unlink_entity(
    term_id: uuid.UUID, link_id: uuid.UUID,
    db: AsyncSession = Depends(get_db), _: User = Depends(require_steward),
):
    link = (await db.execute(select(TermLink).where(TermLink.id == link_id, TermLink.term_id == term_id))).scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.delete(link)
    await db.commit()
