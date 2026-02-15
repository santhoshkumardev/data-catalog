import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.social import Notification


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> None:
    n = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
    )
    db.add(n)
