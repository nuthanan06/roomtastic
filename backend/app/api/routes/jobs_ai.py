from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.job import Job
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
def hunyuan_generate(body: HunyuanGenerateBody, db: Session = Depends(get_db)):
    inventory_name = (body.inventory_name or "").strip() or "Generated Item"
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
            "image_base64": body.image_base64,
            "image_url": body.image_url,
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
