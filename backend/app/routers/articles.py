"""Articles — process documentation with rich-text body and MinIO file attachments."""
import uuid
from datetime import datetime, timezone

import nh3
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_steward
from app.database import get_db
from app.models.catalog import Article, ArticleAttachment
from app.models.user import User
from app.schemas.catalog import ArticleCreate, ArticleOut, ArticlePatch, AttachmentOut, PaginatedArticles
from app.services.audit import log_action
from app.services.search_sync import sync_article, remove_document
from app.storage import ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE, delete_file, download_url, upload_file

router = APIRouter(prefix="/api/v1/articles", tags=["articles"])

ALLOWED_PATCH = {"title", "description", "sme_name", "sme_email", "body", "tags"}


def _att_out(att: ArticleAttachment) -> AttachmentOut:
    return AttachmentOut(
        id=att.id, article_id=att.article_id, filename=att.filename,
        content_type=att.content_type, file_size=att.file_size, s3_key=att.s3_key,
        download_url=download_url(att.s3_key), created_at=att.created_at,
    )


def _to_out(a: Article) -> ArticleOut:
    return ArticleOut(
        id=a.id, title=a.title, description=a.description,
        sme_name=a.sme_name, sme_email=a.sme_email, body=a.body,
        tags=a.tags, created_by=a.created_by,
        creator_name=a.creator.name if a.creator else None,
        created_at=a.created_at, updated_at=a.updated_at,
        attachments=[_att_out(att) for att in a.attachments],
    )


@router.get("", response_model=PaginatedArticles)
async def list_articles(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    stmt = select(Article).where(Article.deleted_at.is_(None))
    count_stmt = select(func.count()).select_from(Article).where(Article.deleted_at.is_(None))
    if q:
        like_q = f"%{q}%"
        stmt = stmt.where(Article.title.ilike(like_q) | Article.description.ilike(like_q))
        count_stmt = count_stmt.where(Article.title.ilike(like_q) | Article.description.ilike(like_q))
    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt.order_by(Article.updated_at.desc()).offset((page - 1) * size).limit(size))).scalars().all()
    items = []
    for row in rows:
        await db.refresh(row, ["creator", "attachments"])
        items.append(_to_out(row))
    return PaginatedArticles(total=total, page=page, size=size, items=items)


@router.post("", response_model=ArticleOut, status_code=201)
async def create_article(
    payload: ArticleCreate, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_steward),
):
    body = nh3.clean(payload.body) if payload.body else payload.body
    a = Article(
        title=payload.title, description=payload.description,
        sme_name=payload.sme_name, sme_email=payload.sme_email,
        body=body, tags=payload.tags, created_by=current_user.id,
    )
    db.add(a)
    await log_action(db, "article", str(a.id), "create", current_user.id, new_data={"title": a.title})
    await db.commit()
    await db.refresh(a, ["creator", "attachments"])
    sync_article(a)
    return _to_out(a)


@router.get("/{article_id}", response_model=ArticleOut)
async def get_article(article_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    a = (await db.execute(select(Article).where(Article.id == article_id, Article.deleted_at.is_(None)))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.refresh(a, ["creator", "attachments"])
    return _to_out(a)


@router.patch("/{article_id}", response_model=ArticleOut)
async def patch_article(
    article_id: uuid.UUID, patch: ArticlePatch,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    a = (await db.execute(select(Article).where(Article.id == article_id, Article.deleted_at.is_(None)))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Article not found")
    changes = {k: v for k, v in patch.model_dump(exclude_unset=True).items() if k in ALLOWED_PATCH}
    if "body" in changes and changes["body"]:
        changes["body"] = nh3.clean(changes["body"])
    old_data = {"title": a.title, "description": a.description}
    for field, value in changes.items():
        setattr(a, field, value)
    await log_action(db, "article", str(article_id), "update", current_user.id, old_data, changes)
    await db.commit()
    await db.refresh(a, ["creator", "attachments"])
    sync_article(a)
    return _to_out(a)


@router.delete("/{article_id}", status_code=204)
async def delete_article(
    article_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_steward),
):
    a = (await db.execute(select(Article).where(Article.id == article_id, Article.deleted_at.is_(None)))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Article not found")
    a.deleted_at = datetime.now(timezone.utc)
    await log_action(db, "article", str(article_id), "delete", current_user.id, old_data={"title": a.title})
    await db.commit()
    remove_document("articles", str(article_id))


@router.post("/{article_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    article_id: uuid.UUID, file: UploadFile,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    a = (await db.execute(select(Article).where(Article.id == article_id, Article.deleted_at.is_(None)))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Article not found")
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed")
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    s3_key = upload_file(data, file.content_type or "application/octet-stream", file.filename or "upload")
    att = ArticleAttachment(
        article_id=article_id, filename=file.filename or "upload",
        content_type=file.content_type, file_size=len(data),
        s3_key=s3_key, uploaded_by=current_user.id,
    )
    db.add(att)
    await db.commit()
    await db.refresh(att)
    return _att_out(att)


@router.get("/{article_id}/attachments/{attachment_id}")
async def get_attachment_url(
    article_id: uuid.UUID, attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user),
):
    att = (await db.execute(
        select(ArticleAttachment).where(ArticleAttachment.id == attachment_id, ArticleAttachment.article_id == article_id)
    )).scalar_one_or_none()
    if att is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return {"download_url": download_url(att.s3_key)}


@router.delete("/{article_id}/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    article_id: uuid.UUID, attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_steward),
):
    att = (await db.execute(
        select(ArticleAttachment).where(ArticleAttachment.id == attachment_id, ArticleAttachment.article_id == article_id)
    )).scalar_one_or_none()
    if att is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    delete_file(att.s3_key)
    await db.delete(att)
    await db.commit()
