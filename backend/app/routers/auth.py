"""OAuth 2.0 login flow for Google, Azure AD, generic OIDC, plus local email/password login."""
import uuid
from datetime import datetime, timezone

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.jwt import create_access_token, decode_access_token
from app.config import settings
from app.database import get_db
from app.middleware.rate_limit import limiter
from app.models.group import Group, UserGroup
from app.models.user import User
from app.redis_client import blacklist_token, cache_user_delete

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LocalLoginRequest(BaseModel):
    email: str
    password: str


router = APIRouter(prefix="/auth", tags=["auth"])

oauth = OAuth()

if settings.google_client_id:
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

if settings.azure_client_id:
    oauth.register(
        name="azure",
        client_id=settings.azure_client_id,
        client_secret=settings.azure_client_secret,
        server_metadata_url=f"https://login.microsoftonline.com/{settings.azure_tenant_id}/v2.0/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

if settings.oidc_issuer_url:
    oauth.register(
        name="oidc",
        client_id=settings.oidc_client_id,
        client_secret=settings.oidc_client_secret,
        server_metadata_url=f"{settings.oidc_issuer_url.rstrip('/')}/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

PROVIDERS = {"google", "azure", "oidc"}


ROLE_PRIORITY = {"admin": 3, "steward": 2, "viewer": 1}


def _resolve_role_from_groups(groups: list[str] | None) -> str | None:
    """Map AD/OIDC group membership to application role (legacy env-var mapping)."""
    if not groups:
        return None
    if settings.oidc_admin_group and settings.oidc_admin_group in groups:
        return "admin"
    if settings.oidc_steward_group and settings.oidc_steward_group in groups:
        return "steward"
    return "viewer"


async def _sync_user_groups(db, user: User, ad_groups: list[str]) -> str | None:
    """Sync AD group claims → user_groups table and derive effective role."""
    # Store raw AD group names on user
    user.ad_groups = ad_groups

    # Find all application groups that match any of the user's AD groups
    matched = (await db.execute(
        select(Group).where(Group.ad_group_name.in_(ad_groups))
    )).scalars().all()

    matched_ids = {g.id for g in matched}

    # Remove user_groups not matching current AD groups
    existing_ugs = (await db.execute(
        select(UserGroup).where(UserGroup.user_id == user.id)
    )).scalars().all()

    for ug in existing_ugs:
        if ug.group_id not in matched_ids:
            await db.delete(ug)

    existing_group_ids = {ug.group_id for ug in existing_ugs}

    # Add new memberships
    for g in matched:
        if g.id not in existing_group_ids:
            db.add(UserGroup(user_id=user.id, group_id=g.id))

    # Derive highest role from matched groups
    if not matched:
        return None
    best_role = max(matched, key=lambda g: ROLE_PRIORITY.get(g.app_role, 0))
    return best_role.app_role


@router.get("/providers")
async def auth_providers():
    providers = []
    if settings.google_client_id:
        providers.append({"name": "google", "label": "Google"})
    if settings.azure_client_id:
        providers.append({"name": "azure", "label": "Azure AD"})
    if settings.oidc_issuer_url:
        providers.append({"name": "oidc", "label": "SSO"})
    return {"providers": providers}


@router.get("/login/{provider}")
async def login(provider: str, request: Request):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported provider")
    client = oauth.create_client(provider)
    redirect_uri = f"{settings.app_base_url}/auth/callback/{provider}"
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/callback/{provider}")
async def callback(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported provider")
    client = oauth.create_client(provider)
    token = await client.authorize_access_token(request)
    user_info = token.get("userinfo")
    if not user_info:
        user_info = await client.userinfo(token=token)

    email = user_info.get("email")
    name = user_info.get("name") or email
    sub = user_info.get("sub")

    if not email or not sub:
        raise HTTPException(status_code=400, detail="Could not retrieve user info from provider")

    # Resolve role from OIDC group claims
    groups = user_info.get(settings.oidc_groups_claim) if provider == "oidc" else None
    group_role = _resolve_role_from_groups(groups)

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            email=email,
            name=name,
            role=group_role or "viewer",
            oauth_provider=provider,
            oauth_sub=sub,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Sync AD groups → user_groups and derive effective role
    if groups:
        db_role = await _sync_user_groups(db, user, groups)
        if db_role:
            user.role = db_role
        elif group_role is not None:
            user.role = group_role
    elif group_role is not None:
        user.role = group_role

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    await cache_user_delete(str(user.id))

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    redirect_url = f"{settings.frontend_url}/auth/callback?token={access_token}"
    return RedirectResponse(url=redirect_url)


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
    }


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user), request: Request = None):
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = decode_access_token(token)
            jti = payload.get("jti")
            exp = payload.get("exp", 0)
            if jti:
                import time
                ttl = max(int(exp - time.time()), 1)
                await blacklist_token(jti, ttl)
        except Exception:
            pass
    await cache_user_delete(str(current_user.id))
    return {"message": "Logged out"}


@router.post("/login")
@limiter.limit("10/minute")
async def local_login(body: LocalLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not pwd_context.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}
