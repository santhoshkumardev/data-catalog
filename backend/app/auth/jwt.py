import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.config import settings
from app.redis_client import is_token_blacklisted


def create_access_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload["exp"] = expire
    payload["jti"] = str(uuid.uuid4())
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


async def decode_and_validate_token(token: str) -> dict[str, Any]:
    payload = decode_access_token(token)
    jti = payload.get("jti")
    if jti and await is_token_blacklisted(jti):
        raise JWTError("Token has been revoked")
    return payload
