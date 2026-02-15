import hashlib
import hmac

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhooks import Webhook, WebhookEvent


async def fire_webhook(db: AsyncSession, event_type: str, payload: dict) -> None:
    result = await db.execute(
        select(Webhook).where(Webhook.is_active == True)
    )
    webhooks = result.scalars().all()

    for wh in webhooks:
        if wh.events and event_type not in wh.events:
            continue

        headers = {"Content-Type": "application/json"}
        if wh.secret:
            import json
            body_bytes = json.dumps(payload, default=str).encode()
            sig = hmac.new(wh.secret.encode(), body_bytes, hashlib.sha256).hexdigest()
            headers["X-Webhook-Signature"] = sig

        status_code = None
        response_body = None
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(wh.url, json=payload, headers=headers)
                status_code = resp.status_code
                response_body = resp.text[:1000]
        except Exception as e:
            response_body = str(e)[:1000]

        event = WebhookEvent(
            webhook_id=wh.id,
            event_type=event_type,
            payload=payload,
            status_code=status_code,
            response_body=response_body,
        )
        db.add(event)
