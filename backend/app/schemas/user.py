from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserMe(BaseModel):
    id: uuid.UUID
    clerk_user_id: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: str
    status: str = "active"
    last_active_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class OnboardRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "associate"
    firm_name: Optional[str] = None


class OnboardResponse(BaseModel):
    user: UserMe
    org_id: Optional[uuid.UUID] = None


# ─── Org management ───────────────────────────────────────────────────────────

class OrgMemberOut(BaseModel):
    membership_id: uuid.UUID
    user_id: uuid.UUID
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    org_role: str
    membership_status: str
    user_status: str
    last_active_at: Optional[datetime]
    joined_at: datetime


class OrgInvitationOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    status: str
    created_at: datetime
    invited_by_name: Optional[str] = None


class InviteRequest(BaseModel):
    email: str
    role: str = "associate"
    note: Optional[str] = None


class UpdateRoleRequest(BaseModel):
    role: str
