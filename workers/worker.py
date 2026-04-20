from __future__ import annotations

import os
import sys
import time
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND = os.environ.get("BACKEND_PATH", os.path.join(ROOT, "backend"))
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from sqlalchemy import select

from app.models.job import Job, JobStatus
from app.db.session import session_scope
from app.db.init_db import init_db

POLL_INTERVAL_SECONDS = float(os.environ.get("WORKER_POLL_INTERVAL", "1.0"))


def _now() -> datetime:
    return datetime.utcnow()


def _claim_next_job():
    """Claim the next pending job using FOR UPDATE SKIP LOCKED for concurrency safety.

    FOR UPDATE SKIP LOCKED ensures only one worker claims each job, preventing race conditions.
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


def _handle_hunyuan_generate(job_id, payload: dict):
    image_url = str(payload.get("image_url") or "").strip()
    if not image_url:
        raise RuntimeError("image_url is required")

    quality = str(payload.get("quality") or "standard")
    include_texture = bool(payload.get("include_texture", True))

    raise RuntimeError(
        "hunyuan.generate is not implemented yet. Implement RunPod submission/polling before enabling this job. "
        f"Received image_url={image_url!r}, quality={quality!r}, include_texture={include_texture!r}"
    )


HANDLERS = {
    "hunyuan.generate": _handle_hunyuan_generate,
}


def run_forever():
    # Ensure all tables (including `jobs`) exist before polling. The backend also
    # runs create_all on startup, but the worker may start first in compose.
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
                    raise RuntimeError(f"no handler for job type {j.type}")
                payload = j.payload or {}
            result = handler(job_id, payload)
            _finish_job(job_id, status=JobStatus.succeeded, result=result, error=None)
        except Exception as e:
            _finish_job(job_id, status=JobStatus.failed, result=None, error=str(e))


if __name__ == "__main__":
    run_forever()
