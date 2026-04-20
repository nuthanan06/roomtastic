from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.job import Job, JobStatus
from app.schemas.job import (
    HunyuanGenerateBody,
    JobOut,
)

router = APIRouter(tags=["jobs", "ai"])


def _enqueue(db: Session, job_type: str, payload: dict) -> Job:
    # TODO(redis): replace DB polling queue with Redis queue once worker architecture migrates.
    now = datetime.utcnow()
    j = Job(
        type=job_type,
        status=JobStatus.pending,
        payload=payload,
        created_at=now,
        updated_at=now,
    )
    db.add(j)
    db.commit()
    db.refresh(j)
    return j


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: UUID, db: Session = Depends(get_db)):
    j = db.get(Job, job_id)
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobOut.model_validate(j)


@router.post("/jobs/hunyuan/generate", response_model=JobOut)
def hunyuan_generate(body: HunyuanGenerateBody, db: Session = Depends(get_db)):
    j = _enqueue(
        db,
        "hunyuan.generate",
        {
            "image_url": body.image_url,
            "quality": body.quality,
            "include_texture": body.include_texture,
        },
    )
    return JobOut.model_validate(j)
