"""
Roomtastic background worker.

Polls the jobs table for pending work and dispatches to the appropriate handler.
Add new job types by registering a handler in HANDLERS below.

Job lifecycle: pending → running → succeeded | failed
"""
from __future__ import annotations

import os
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path


# ── Path setup ───────────────────────────────────────────────────────────────

def _resolve_path(raw: str | None, *, base: Path, default: Path) -> str:
    candidate = Path(raw).expanduser() if raw else default
    if not candidate.is_absolute():
        candidate = (base / candidate).resolve()
    return str(candidate)


WORKERS_DIR = Path(__file__).resolve().parent
ROOT = WORKERS_DIR.parent
BACKEND = _resolve_path(
    os.environ.get("BACKEND_PATH"), base=WORKERS_DIR, default=ROOT / "backend"
)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from sqlalchemy import select  # noqa: E402

from app.db.init_db import init_db  # noqa: E402
from app.db.session import session_scope  # noqa: E402
from app.models.job import Job, JobStatus  # noqa: E402


# ── Configuration ─────────────────────────────────────────────────────────────

POLL_INTERVAL_SECONDS = float(os.environ.get("WORKER_POLL_INTERVAL", "1.0"))
HUNYUAN_OUTPUT_DIR = _resolve_path(
    os.environ.get("HUNYUAN_OUTPUT_DIR"),
    base=ROOT,
    default=Path(BACKEND) / "glb_models",
)
PUBLIC_BACKEND_URL = os.environ.get("PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")


# ── Job handlers ──────────────────────────────────────────────────────────────

# Import after path setup so app.* imports resolve correctly.
from hunyuan import handle_hunyuan_generate  # noqa: E402

HANDLERS = {
    "hunyuan.generate": handle_hunyuan_generate,
}


# ── Startup ───────────────────────────────────────────────────────────────────

def _backfill_legacy_output_dir() -> None:
    """Copies any GLBs from the old output location into the current one."""
    target_dir = Path(HUNYUAN_OUTPUT_DIR)
    legacy_dir = WORKERS_DIR / "backend" / "glb_models"
    if not legacy_dir.exists() or legacy_dir.resolve() == target_dir.resolve():
        return
    target_dir.mkdir(parents=True, exist_ok=True)
    for src in legacy_dir.glob("*.glb"):
        dst = target_dir / src.name
        if not dst.exists():
            shutil.copy2(src, dst)


# ── Job queue ─────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.utcnow()


def _claim_next_job():
    """
    Atomically claims the next pending job using FOR UPDATE SKIP LOCKED.
    Returns the job_id if one was claimed, otherwise None.
    """
    with session_scope() as s:
        j = (
            s.execute(
                select(Job)
                .where(Job.status == JobStatus.pending)
                .order_by(Job.created_at.asc())
                .with_for_update(skip_locked=True)
                .limit(1)
            )
            .scalars()
            .first()
        )
        if not j:
            return None
        j.status = JobStatus.running
        j.started_at = _now()
        j.updated_at = _now()
        j.attempts = int(j.attempts or 0) + 1
        s.add(j)
        s.commit()
        s.refresh(j)
        return j.job_id


def _finish_job(job_id, *, status: JobStatus, result=None, error: str | None = None):
    """Writes the terminal status, result, and error onto a completed job."""
    with session_scope() as s:
        j = s.get(Job, job_id)
        if not j:
            return
        j.status = status
        j.result = result
        j.error = error
        j.finished_at = _now()
        j.updated_at = _now()
        s.add(j)


# ── Main loop ─────────────────────────────────────────────────────────────────

def run_forever():
    _backfill_legacy_output_dir()
    init_db()
    print("Roomtastic worker started. Polling DB for jobs...")

    while True:
        job_id = _claim_next_job()
        if not job_id:
            time.sleep(POLL_INTERVAL_SECONDS)
            continue

        try:
            with session_scope() as s:
                j = s.get(Job, job_id)
                if not j:
                    continue
                handler = HANDLERS.get(j.type)
                if not handler:
                    raise RuntimeError(f"No handler registered for job type '{j.type}'")
                payload = j.payload or {}
            result = handler(job_id, payload)
            _finish_job(job_id, status=JobStatus.succeeded, result=result)
        except Exception as e:
            _finish_job(job_id, status=JobStatus.failed, error=str(e))


if __name__ == "__main__":
    run_forever()
