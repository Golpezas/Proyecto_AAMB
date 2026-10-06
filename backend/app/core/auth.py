# backend/app/core/auth.py
# Creator authentication = Supabase Auth JWT verification (ADR 0005).
#
# Supabase Auth issues access tokens signed with the project JWT secret
# (HS256, audience "authenticated"). The backend verifies them here and uses
# the `sub` claim as the creator identity: `creators.id == auth.uid()`.
# An empty SUPABASE_JWT_SECRET is a 500 (fail loud) -- never a silent accept.
import uuid
from dataclasses import dataclass

import jwt
from fastapi import Header, HTTPException

from app.core.config import settings

_ALGORITHMS = ["HS256"]
_AUDIENCE = "authenticated"
_UNAUTHORIZED_HEADERS = {"WWW-Authenticate": "Bearer"}


@dataclass(frozen=True)
class CreatorClaims:
    """Verified identity from a Supabase Auth access token."""

    id: str  # `sub` == auth.uid() == creators.id (a UUID)
    email: str | None  # `email` claim; None when the token omits it


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=401, detail=detail, headers=_UNAUTHORIZED_HEADERS
    )


def _decode_creator_claims(authorization: str | None) -> CreatorClaims:
    if not settings.supabase_jwt_secret:
        # Fail loud: an unconfigured server must never silently accept tokens.
        raise HTTPException(
            status_code=500,
            detail=(
                "Creator auth is not configured: SUPABASE_JWT_SECRET is empty. "
                "Set it before calling authenticated endpoints."
            ),
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise _unauthorized("Not authenticated")
    token = authorization[len("Bearer ") :].strip()
    if not token:
        raise _unauthorized("Not authenticated")
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=_ALGORITHMS,
            audience=_AUDIENCE,
        )
    except jwt.PyJWTError:
        raise _unauthorized("Invalid or expired token")
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise _unauthorized("Token has no subject claim")
    try:
        uuid.UUID(sub)
    except ValueError:
        raise _unauthorized("Token subject is not a valid user id")
    email = payload.get("email")
    if not isinstance(email, str) or not email:
        email = None
    return CreatorClaims(id=sub, email=email)


def get_current_creator(
    authorization: str | None = Header(default=None),
) -> CreatorClaims:
    """Verified caller identity. Same verification path as
    get_current_creator_id; endpoints that also need the `email` claim
    (channel creation) depend on this instead of decoding the JWT twice.
    """
    return _decode_creator_claims(authorization)


def get_current_creator_id(authorization: str | None = Header(default=None)) -> str:
    """Supabase user id (`sub` == `auth.uid()`) of the caller.

    Raises 401 for missing/invalid tokens and 500 when auth is not
    configured (SUPABASE_JWT_SECRET empty).
    """
    return _decode_creator_claims(authorization).id
