from pydantic import BaseModel, ConfigDict
from typing import Optional


class PositionBase(BaseModel):
    x: int
    y: int
    z: int


class PositionCreate(PositionBase):
    pass


class PositionUpdate(PositionBase):
    pass


class PositionOut(PositionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
