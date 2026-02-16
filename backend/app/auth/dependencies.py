import uuid
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_and_validate_token
from app.config import settings
from app.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


async def _resolve_user_from_token(
    credentials: HTTPAuthorizationCredentials,
    db: AsyncSession,
) -> User:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    try:
        payload = await decode_and_validate_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id:
            raise exc
    except JWTError:
        raise exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise exc
    return user


def resolve_sso_role(groups_header: str | None) -> str | None:
    """Map semicolon-delimited Shibboleth groups header to application role."""
    if not groups_header:
        return None
    groups = [g.strip() for g in groups_header.split(";") if g.strip()]
    if not groups:
        return None
    if settings.sso_admin_group and settings.sso_admin_group in groups:
        return "admin"
    if settings.sso_steward_group and settings.sso_steward_group in groups:
        return "steward"
    return "viewer"


async def _resolve_user_from_sso_headers(
    request: Request,
    db: AsyncSession,
) -> User:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO headers missing")
    email = request.headers.get(settings.sso_header_email)
    if not email:
        raise exc

    display_name = request.headers.get(settings.sso_header_name) or email
    groups_header = request.headers.get(settings.sso_header_groups)
    group_role = resolve_sso_role(groups_header)

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            email=email,
            name=display_name,
            role=group_role or settings.sso_default_role,
            oauth_provider="shibboleth",
            oauth_sub=email,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if group_role is not None:
            user.role = group_role

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    return user


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is not None:
        return await _resolve_user_from_token(credentials, db)

    if settings.auth_mode == "sso":
        return await _resolve_user_from_sso_headers(request, db)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


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
