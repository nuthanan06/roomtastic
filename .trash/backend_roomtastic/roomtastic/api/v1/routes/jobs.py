from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from roomtastic.api.deps import get_current_user
from roomtastic.api.v1.schemas import JobOut
from roomtastic.db.models import Job, User
from roomtastic.db.session import get_session

router = APIRouter()


def _job_out(j: Job) -> JobOut:
    return JobOut(
        job_id=j.job_id,
        type=j.type,
        status=j.status.value if hasattr(j.status, "value") else str(j.status),
        payload=j.payload or {},
        result=j.result,
        error=j.error,
        attempts=j.attempts,
        created_at=j.created_at,
        started_at=j.started_at,
        finished_at=j.finished_at,
        updated_at=j.updated_at,
    )


@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Jobs are currently user-less; we still require auth.
    j = session.get(Job, job_id)
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_out(j)

