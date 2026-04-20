from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.job import JobStatus


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: UUID
    type: str
    status: JobStatus
    payload: dict[str, Any]
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    attempts: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    updated_at: datetime


class HunyuanGenerateBody(BaseModel):
    image_url: str
    quality: Optional[str] = "standard"
    include_texture: bool = True
