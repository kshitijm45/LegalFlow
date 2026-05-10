"""
/api/v1/users — user profile and org management endpoints.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkClaims, get_current_user
from app.config import settings
from app.db.session import get_db
from app.models.org import Org
from app.models.user import OrgInvitation, OrgMembership, User
from app.schemas.user import (
    InviteRequest, OrgInvitationOut, OrgMemberOut,
    OnboardRequest, OnboardResponse, UpdateRoleRequest, UserMe,
)

router = APIRouter(prefix="/users", tags=["users"])


async def _fetch_clerk_email(clerk_user_id: str) -> str:
    """Fetch the user's primary email from Clerk's backend API."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.clerk.com/v1/users/{clerk_user_id}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            emails = data.get("email_addresses", [])
            if emails:
                return emails[0].get("email_address", "")
    return ""


@router.get("/me", response_model=UserMe)
async def get_me(
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserMe:
    result = await db.execute(select(User).where(User.clerk_user_id == claims.sub))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserMe.model_validate(user)


@router.post("/onboard", response_model=OnboardResponse, status_code=status.HTTP_201_CREATED)
async def onboard(
    body: OnboardRequest,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OnboardResponse:
    email = claims.email or await _fetch_clerk_email(claims.sub)

    # Find by clerk_user_id OR email (handles OAuth account linking)
    result = await db.execute(
        select(User).where(
            or_(User.clerk_user_id == claims.sub, User.email == email) if email
            else User.clerk_user_id == claims.sub
        ).limit(1)
    )
    user = result.scalar_one_or_none()

    if user is None:
        # New user — upsert on email to survive any race condition
        stmt = (
            pg_insert(User)
            .values(
                clerk_user_id=claims.sub,
                email=email,
                first_name=body.first_name or claims.first_name or "",
                last_name=body.last_name or claims.last_name or "",
                role=body.role,
            )
            .on_conflict_do_update(
                index_elements=["email"],
                set_={"clerk_user_id": claims.sub},
            )
            .returning(User)
        )
        result2 = await db.execute(stmt)
        user = result2.scalar_one()
        await db.flush()
    else:
        # Existing user — sync clerk_user_id and backfill email if needed
        user.clerk_user_id = claims.sub
        if email and (not user.email or "@" not in user.email):
            user.email = email

    org_id: Optional[uuid.UUID] = None
    if body.firm_name:
        slug = _slugify(body.firm_name)
        result = await db.execute(select(Org).where(Org.slug == slug))
        org = result.scalar_one_or_none()

        if org is None:
            org = Org(name=body.firm_name, slug=slug)
            db.add(org)
            await db.flush()

        # Add membership if not already present
        existing = await db.execute(
            select(OrgMembership).where(
                OrgMembership.user_id == user.id,
                OrgMembership.org_id == org.id,
            )
        )
        if existing.scalar_one_or_none() is None:
            db.add(OrgMembership(user_id=user.id, org_id=org.id, org_role="admin"))

        org_id = org.id

    # Auto-accept any pending invitation for this email
    if email and org_id is None:
        inv_result = await db.execute(
            select(OrgInvitation).where(OrgInvitation.email == email, OrgInvitation.status == "pending")
        )
        inv = inv_result.scalar_one_or_none()
        if inv:
            existing_mem = await db.execute(
                select(OrgMembership).where(OrgMembership.user_id == user.id, OrgMembership.org_id == inv.org_id)
            )
            if existing_mem.scalar_one_or_none() is None:
                db.add(OrgMembership(user_id=user.id, org_id=inv.org_id, org_role=inv.role))
            inv.status = "accepted"
            org_id = inv.org_id

    await db.commit()
    await db.refresh(user)
    return OnboardResponse(user=UserMe.model_validate(user), org_id=org_id)


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug[:128]


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_user_and_org(claims: ClerkClaims, db: AsyncSession) -> tuple[User, uuid.UUID]:
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User).options(selectinload(User.memberships)).where(User.clerk_user_id == claims.sub)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not onboarded")
    if not user.memberships:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of any organisation")
    return user, user.memberships[0].org_id


def _user_display_name(u: User) -> str:
    parts = [u.first_name or "", u.last_name or ""]
    name = " ".join(p for p in parts if p).strip()
    return name or u.email


# ─── Org: list members + invitations ─────────────────────────────────────────

@router.get("/org/members")
async def list_org_members(
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from sqlalchemy.orm import selectinload
    user, org_id = await _get_user_and_org(claims, db)

    # Update caller's last_active_at
    user.last_active_at = datetime.now(timezone.utc)
    await db.commit()

    # All memberships for this org
    result = await db.execute(
        select(OrgMembership)
        .options(selectinload(OrgMembership.user))
        .where(OrgMembership.org_id == org_id)
        .order_by(OrgMembership.joined_at)
    )
    memberships = result.scalars().all()

    members = [
        OrgMemberOut(
            membership_id=m.id,
            user_id=m.user_id,
            email=m.user.email,
            first_name=m.user.first_name,
            last_name=m.user.last_name,
            org_role=m.org_role,
            membership_status=m.status,
            user_status=m.user.status,
            last_active_at=m.user.last_active_at,
            joined_at=m.joined_at,
        )
        for m in memberships
    ]

    # Pending / revoked invitations
    inv_result = await db.execute(
        select(OrgInvitation)
        .where(OrgInvitation.org_id == org_id, OrgInvitation.status == "pending")
        .order_by(OrgInvitation.created_at.desc())
    )
    invitations_raw = inv_result.scalars().all()

    # Fetch inviter names
    inviter_ids = list({i.invited_by for i in invitations_raw if i.invited_by})
    inviters: dict[uuid.UUID, str] = {}
    if inviter_ids:
        ir = await db.execute(select(User).where(User.id.in_(inviter_ids)))
        for u in ir.scalars():
            inviters[u.id] = _user_display_name(u)

    invitations = [
        OrgInvitationOut(
            id=i.id,
            email=i.email,
            role=i.role,
            status=i.status,
            created_at=i.created_at,
            invited_by_name=inviters.get(i.invited_by) if i.invited_by else None,
        )
        for i in invitations_raw
    ]

    org_result = await db.execute(select(Org).where(Org.id == org_id))
    org = org_result.scalar_one()

    return {"members": [m.model_dump() for m in members], "invitations": [i.model_dump() for i in invitations], "org_name": org.name, "plan": org.plan}


# ─── Org: invite ─────────────────────────────────────────────────────────────

@router.post("/org/invite", status_code=status.HTTP_201_CREATED)
async def invite_member(
    body: InviteRequest,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user, org_id = await _get_user_and_org(claims, db)

    # Check if email already a member
    existing_user = await db.execute(select(User).where(User.email == body.email))
    eu = existing_user.scalar_one_or_none()
    if eu:
        already = await db.execute(
            select(OrgMembership).where(OrgMembership.user_id == eu.id, OrgMembership.org_id == org_id)
        )
        if already.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="This user is already a member of the organisation")

    # Revoke any existing pending invite for this email
    await db.execute(
        select(OrgInvitation).where(
            OrgInvitation.org_id == org_id,
            OrgInvitation.email == body.email,
            OrgInvitation.status == "pending",
        )
    )

    invitation = OrgInvitation(
        org_id=org_id,
        email=body.email,
        role=body.role,
        invited_by=user.id,
        note=body.note,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    return {
        "id": str(invitation.id),
        "email": invitation.email,
        "role": invitation.role,
        "token": str(invitation.token),
        "invite_link": f"/accept-invite?token={invitation.token}",
    }


# ─── Org: update member role ──────────────────────────────────────────────────

@router.patch("/org/members/{membership_id}/role")
async def update_member_role(
    membership_id: uuid.UUID,
    body: UpdateRoleRequest,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user, org_id = await _get_user_and_org(claims, db)

    result = await db.execute(
        select(OrgMembership).where(OrgMembership.id == membership_id, OrgMembership.org_id == org_id)
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")
    if membership.user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    membership.org_role = body.role
    await db.commit()
    return {"membership_id": str(membership_id), "org_role": body.role}


# ─── Org: suspend / activate member ──────────────────────────────────────────

@router.patch("/org/members/{membership_id}/status")
async def set_member_status(
    membership_id: uuid.UUID,
    body: dict,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user, org_id = await _get_user_and_org(claims, db)

    new_status = body.get("status")
    if new_status not in ("active", "suspended"):
        raise HTTPException(status_code=400, detail="status must be 'active' or 'suspended'")

    result = await db.execute(
        select(OrgMembership).where(OrgMembership.id == membership_id, OrgMembership.org_id == org_id)
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")
    if membership.user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own status")

    membership.status = new_status
    await db.commit()
    return {"membership_id": str(membership_id), "status": new_status}


# ─── Org: remove member ───────────────────────────────────────────────────────

@router.delete("/org/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    membership_id: uuid.UUID,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    user, org_id = await _get_user_and_org(claims, db)

    result = await db.execute(
        select(OrgMembership).where(OrgMembership.id == membership_id, OrgMembership.org_id == org_id)
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")
    if membership.user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    await db.delete(membership)
    await db.commit()


# ─── Org: revoke invitation ───────────────────────────────────────────────────

@router.delete("/org/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: uuid.UUID,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    _, org_id = await _get_user_and_org(claims, db)

    result = await db.execute(
        select(OrgInvitation).where(OrgInvitation.id == invitation_id, OrgInvitation.org_id == org_id)
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")

    invitation.status = "revoked"
    await db.commit()


# ─── Org: resend invitation ───────────────────────────────────────────────────

@router.post("/org/invitations/{invitation_id}/resend")
async def resend_invitation(
    invitation_id: uuid.UUID,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    _, org_id = await _get_user_and_org(claims, db)

    result = await db.execute(
        select(OrgInvitation).where(OrgInvitation.id == invitation_id, OrgInvitation.org_id == org_id)
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Reset token so old link can't be reused
    invitation.token = uuid.uuid4()
    invitation.status = "pending"
    invitation.created_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "id": str(invitation.id),
        "email": invitation.email,
        "invite_link": f"/accept-invite?token={invitation.token}",
    }
