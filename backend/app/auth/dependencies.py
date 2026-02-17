import uuid

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_and_validate_token
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.redis_client import cache_user_get, cache_user_set

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    try:
        payload = await decode_and_validate_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id:
            raise exc
    except JWTError:
        raise exc

    # Check Redis cache first
    cached = await cache_user_get(user_id)
    if cached:
        user = User(
            id=uuid.UUID(cached["id"]),
            email=cached["email"],
            name=cached["name"],
            role=cached["role"],
        )
        return user

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise exc

    # Cache for 5 minutes
    await cache_user_set(user_id, {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
    })
    return user


async def require_steward(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("admin", "steward"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Steward role required")
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return current_user


require_editor_or_steward = require_steward


def require_ingest_api_key(x_api_key: str = Header(..., alias="X-API-Key")) -> None:
    if x_api_key != settings.ingest_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
