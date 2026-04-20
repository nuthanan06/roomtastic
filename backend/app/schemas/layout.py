from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.room import RoomUpdate


class LayoutFurnitureItem(BaseModel):
    client_id: Optional[str] = None
    furniture_id: Optional[UUID] = None
    inventory_id: Optional[UUID] = None
    name_of_furniture: Optional[str] = None
    coordinates: Optional[str] = None
    rotation: Optional[int] = None
    tags: list[str] = Field(default_factory=list)


class LayoutOpeningItem(BaseModel):
    client_id: Optional[str] = None
    opening_id: Optional[UUID] = None
    kind: Literal["door", "window"]
    wall: str
    t: float
    width_m: float
    height_m: float
    sill_m: float = 0.0


class RoomLayoutSyncBody(BaseModel):
    room_patch: Optional[RoomUpdate] = None
    furniture: list[LayoutFurnitureItem] = Field(default_factory=list)
    openings: list[LayoutOpeningItem] = Field(default_factory=list)


class LayoutFurnitureResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    client_id: Optional[str] = None
    furniture_id: UUID


class LayoutOpeningResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    client_id: Optional[str] = None
    opening_id: UUID
    kind: Literal["door", "window"]


class RoomLayoutSyncOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    room_id: UUID
    furniture: list[LayoutFurnitureResult]
    openings: list[LayoutOpeningResult]
