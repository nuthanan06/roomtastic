from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class RoomBase(BaseModel):
    wall_colour: Optional[str] = None
    is_natural_light: Optional[bool] = None
    width: Optional[int] = None
    length: Optional[int] = None
    height: Optional[int] = None


class RoomCreate(RoomBase):
    user_id: UUID


class RoomUpdate(RoomBase):
    pass


class RoomOut(RoomBase):
    model_config = ConfigDict(from_attributes=True)

    room_id: UUID
    user_id: UUID
    last_edited: Optional[datetime] = None
    furniture: Optional[List[UUID]] = None
    windows: Optional[List[UUID]] = None
    doors: Optional[List[UUID]] = None
