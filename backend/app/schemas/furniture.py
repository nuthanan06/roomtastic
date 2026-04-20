from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class FurnitureBase(BaseModel):
    name_of_furniture: Optional[str] = None
    coordinates: Optional[str] = None
    rotation: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    inventory_id: Optional[UUID] = None
    tags: list[str] = Field(default_factory=list)


class FurnitureCreate(FurnitureBase):
    pass


class FurnitureUpdate(FurnitureBase):
    pass


class FurnitureOut(FurnitureBase):
    model_config = ConfigDict(from_attributes=True)

    furniture_id: UUID
    room_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class FurnitureMoveBody(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None


class FurnitureRotateBody(BaseModel):
    rotation: int
