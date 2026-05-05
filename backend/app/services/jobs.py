from datetime import datetime

from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus


def enqueue_job(db: Session, job_type: str, payload: dict) -> Job:
    """Create a pending job in the DB-backed queue."""
    now = datetime.utcnow()
    job = Job(
        type=job_type,
        status=JobStatus.pending,
        payload=payload,
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

