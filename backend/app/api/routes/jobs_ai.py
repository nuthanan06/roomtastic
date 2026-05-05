from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.job import Job
from app.models.user import User
from app.schemas.job import (
    HunyuanGenerateBody,
    JobOut,
)
from app.services.jobs import enqueue_job

router = APIRouter(tags=["jobs", "ai"])


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: UUID, db: Session = Depends(get_db)):
    j = db.get(Job, job_id)
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobOut.model_validate(j)


@router.post("/jobs/hunyuan/generate", response_model=JobOut)
def hunyuan_generate(
    body: HunyuanGenerateBody,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    inventory_name = (body.inventory_name or "").strip() or "Generated Item"
    owner_user_id = str(current_user.user_id)
    j = enqueue_job(
        db,
        "hunyuan.generate",
        {
            "inventory_name": inventory_name,
            "inventory_category": body.inventory_category,
            "inventory_description": body.inventory_description,
            "width": body.width,
            "length": body.length,
            "height": body.height,
            "tags": body.tags,
            "user_id": owner_user_id,
            "image_base64": body.image_base64,
            "image_url": body.image_url,
            "image_mime": body.image_mime,
            "quality": body.quality,
            "include_texture": body.include_texture,
            "num_inference_steps": body.num_inference_steps,
            "octree_resolution": body.octree_resolution,
            "seed": body.seed,
            "guidance_scale": body.guidance_scale,
            "num_chunks": body.num_chunks,
            "face_count": body.face_count,
        },
    )
    return JobOut.model_validate(j)
