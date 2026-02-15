import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.request_id import request_id_ctx
from app.models.audit import AuditLog


async def log_action(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
    action: str,
    actor_id: uuid.UUID | None = None,
    old_data: dict | None = None,
    new_data: dict | None = None,
) -> None:
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=str(entity_id),
        action=action,
        actor_id=actor_id,
        old_data=old_data,
        new_data=new_data,
        request_id=request_id_ctx.get(""),
    )
    db.add(entry)
