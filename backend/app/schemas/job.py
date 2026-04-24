from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.job import JobStatus
from app.schemas.hunyuan import HunyuanGenerateOptions


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


class HunyuanGenerateBody(HunyuanGenerateOptions):
    inventory_name: Optional[str] = None
    inventory_category: Optional[str] = None
    inventory_description: Optional[str] = None
    width: Optional[int] = None
    length: Optional[int] = None
    height: Optional[int] = None
    tags: list[str] = Field(default_factory=list)
