from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal
from uuid import UUID


class OpeningBase(BaseModel):
    kind: Literal["door", "window"]
    wall: Literal["pz", "nz", "px", "nx"]
    t: float
    width_m: float
    height_m: float
    sill_m: float = 0.0


class OpeningCreate(OpeningBase):
    pass


class OpeningUpdate(BaseModel):
    kind: Optional[Literal["door", "window"]] = None
    wall: Optional[Literal["pz", "nz", "px", "nx"]] = None
    t: Optional[float] = None
    width_m: Optional[float] = None
    height_m: Optional[float] = None
    sill_m: Optional[float] = None


class OpeningOut(OpeningBase):
    model_config = ConfigDict(from_attributes=True)

    opening_id: UUID
    room_id: UUID
