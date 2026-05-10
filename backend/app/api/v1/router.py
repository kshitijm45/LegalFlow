from fastapi import APIRouter

from app.api.v1.endpoints import clause_audit, obligations, timeline, users, vault, workflow

router = APIRouter(prefix="/api/v1")
router.include_router(users.router)
router.include_router(vault.router)
router.include_router(timeline.router)
router.include_router(obligations.router)
router.include_router(clause_audit.router)
router.include_router(workflow.router)
