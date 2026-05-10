"""APScheduler jobs: obligation reminders + scheduled workflow triggers."""
from __future__ import annotations

import calendar
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.obligation import Obligation
from app.services.email import send_obligation_reminder

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


# ── Obligation reminders ───────────────────────────────────────────────────────

async def _send_due_reminders() -> None:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        snooze_result = await db.execute(
            select(Obligation).where(
                Obligation.status == "snoozed",
                Obligation.snooze_until.is_not(None),
                Obligation.snooze_until <= now,
            )
        )
        unsnoozed = snooze_result.scalars().all()
        for o in unsnoozed:
            o.status = "pending"
            o.snooze_until = None
        if unsnoozed:
            logger.info("Auto-unsnoozed %d obligation(s)", len(unsnoozed))

        result = await db.execute(
            select(Obligation).where(
                Obligation.reminder_date <= now,
                Obligation.reminder_sent == False,  # noqa: E712
                Obligation.reminder_email.is_not(None),
                Obligation.status != "done",
            )
        )
        obligations = result.scalars().all()

        for o in obligations:
            sent = send_obligation_reminder(
                to_email=o.reminder_email,
                obligation_title=o.title,
                contract_name=o.contract_name or "",
                due_date=o.due_date.isoformat() if o.due_date else None,
                description=o.description,
            )
            if sent:
                o.reminder_sent = True

        if unsnoozed or obligations:
            await db.commit()
            logger.info("Processed %d reminder(s)", len(obligations))


# ── Scheduled workflow triggers ────────────────────────────────────────────────

_WEEKDAY_MAP = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}

# Last day of each quarter-ending month
_QUARTER_END_DAY = {3: 31, 6: 30, 9: 30, 12: 31}


def _parse_time(schedule_time: str) -> tuple[int, int]:
    """Return (hour, minute) from 'HH:MM', defaulting to 09:00."""
    try:
        h, m = map(int, schedule_time.split(":"))
        return h, m
    except (ValueError, AttributeError):
        return 9, 0


def _is_due(
    interval: str,
    schedule_time: str,
    schedule_day: str,
    schedule_dom: str,
    last_run: datetime | None,
    now: datetime,
) -> bool:
    """Return True if a scheduled workflow should fire right now."""
    h, m = _parse_time(schedule_time)

    # The exact datetime this period's run is scheduled for
    scheduled_this_period = now.replace(hour=h, minute=m, second=0, microsecond=0)

    # Haven't reached scheduled time today yet
    if now < scheduled_this_period:
        return False

    if interval == "daily":
        if last_run is None:
            return True
        return last_run < scheduled_this_period

    if interval == "weekly":
        target_weekday = _WEEKDAY_MAP.get((schedule_day or "monday").lower(), 0)
        if now.weekday() != target_weekday:
            return False
        if last_run is None:
            return True
        return last_run < scheduled_this_period

    if interval == "monthly":
        try:
            target_dom = int(schedule_dom)
        except (ValueError, TypeError):
            target_dom = 1
        max_day = calendar.monthrange(now.year, now.month)[1]
        effective_dom = min(target_dom, max_day)
        if now.day != effective_dom:
            return False
        if last_run is None:
            return True
        return last_run < scheduled_this_period

    if interval == "quarterly":
        if now.month not in _QUARTER_END_DAY:
            return False
        if now.day != _QUARTER_END_DAY[now.month]:
            return False
        if last_run is None:
            return True
        return last_run < scheduled_this_period

    return False


async def _fire_scheduled_workflows() -> None:
    """Check all active workflows for schedule triggers and fire any that are due."""
    from app.models.workflow import Workflow, WorkflowRun
    from app.models.contract import Contract
    from app.services.workflow_executor import execute_workflow

    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Workflow).where(Workflow.status == "active")
        )
        workflows = result.scalars().all()

        for wf in workflows:
            nodes: list[dict] = wf.nodes or []
            trigger = next((n for n in nodes if n.get("type") == "trigger"), None)
            if not trigger:
                continue

            data = trigger.get("data", {})
            if data.get("triggerType") != "schedule":
                continue

            interval   = data.get("scheduleInterval", "daily")
            sched_time = data.get("scheduleTime", "09:00")
            sched_day  = data.get("scheduleDay", "monday")
            sched_dom  = data.get("scheduleDayOfMonth", "1")

            last_run_aware = wf.last_run
            if last_run_aware is not None and last_run_aware.tzinfo is None:
                last_run_aware = last_run_aware.replace(tzinfo=timezone.utc)

            if not _is_due(interval, sched_time, sched_day, sched_dom, last_run_aware, now):
                continue

            logger.info(
                "Firing scheduled workflow %s (%s) — interval=%s time=%s",
                wf.id, wf.name, interval, sched_time,
            )

            run = WorkflowRun(
                workflow_id=wf.id,
                status="pending",
                trigger_type="schedule",
            )
            db.add(run)
            await db.flush()  # populate run.id before passing to executor

            try:
                await execute_workflow(wf, run, None, db)
            except Exception:
                logger.exception("Scheduled execution failed for workflow %s", wf.id)


# ── Startup / shutdown ─────────────────────────────────────────────────────────

def start_scheduler() -> None:
    scheduler.add_job(
        _send_due_reminders,
        trigger="interval",
        hours=1,
        id="obligation_reminders",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc),
    )
    scheduler.add_job(
        _fire_scheduled_workflows,
        trigger="interval",
        minutes=1,
        id="workflow_scheduler",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc),
    )
    scheduler.start()
    logger.info("Scheduler started (obligations + workflow triggers)")


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
