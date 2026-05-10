"""
Clerk JWT verification dependency for FastAPI.

Clerk signs JWTs with RS256. The public keys are fetched from Clerk's JWKS endpoint
and cached in-process. Every request verifies the JWT before hitting any handler.
"""
from __future__ import annotations

import time
from functools import lru_cache
from typing import Any, Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_bearer = HTTPBearer()

# ---------------------------------------------------------------------------
# JWKS cache — refresh at most once every 5 minutes
# ---------------------------------------------------------------------------
_jwks_cache: dict[str, Any] = {}
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 300  # seconds


def _clerk_jwks_url() -> str:
    # e.g. pk_test_abc123  →  abc123.clerk.accounts.dev
    raw = settings.clerk_publishable_key.removeprefix("pk_test_").removeprefix("pk_live_")
    # Clerk frontend API URL is embedded in the publishable key after base64-decoding
    # but the simplest approach is to hit the well-known JWKS endpoint directly.
    return "https://api.clerk.com/v1/jwks"


async def _get_jwks() -> dict[str, Any]:
    global _jwks_cache, _jwks_fetched_at

    now = time.monotonic()
    if _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_cache

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            _clerk_jwks_url(),
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            timeout=10,
        )
        resp.raise_for_status()

    _jwks_cache = resp.json()
    _jwks_fetched_at = now
    return _jwks_cache


# ---------------------------------------------------------------------------
# ClerkClaims — the parsed JWT payload
# ---------------------------------------------------------------------------
class ClerkClaims:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.sub: str = payload["sub"]  # Clerk user_id  e.g. "user_2abc..."
        self.email: str = payload.get("email", "")
        self.first_name: Optional[str] = payload.get("first_name")
        self.last_name: Optional[str] = payload.get("last_name")
        self.org_id: Optional[str] = payload.get("org_id")
        self.org_role: Optional[str] = payload.get("org_role")
        self.raw = payload


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> ClerkClaims:
    token = credentials.credentials
    jwks = await _get_jwks()

    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")

        # Find matching key
        key_data = next(
            (k for k in jwks.get("keys", []) if k.get("kid") == kid), None
        )
        if key_data is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown signing key"
            )

        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return ClerkClaims(payload)

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}"
        )
