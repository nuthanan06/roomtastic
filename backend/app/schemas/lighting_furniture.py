from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID


class LightingFurnitureBase(BaseModel):
    type: Optional[str] = None
    intensity: Optional[float] = None
    color_temperature: Optional[int] = None
    furniture_id: Optional[UUID] = None


class LightingFurnitureCreate(LightingFurnitureBase):
    pass


class LightingFurnitureUpdate(LightingFurnitureBase):
    pass


class LightingFurnitureOut(LightingFurnitureBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
