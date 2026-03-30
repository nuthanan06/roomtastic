from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID

class DoorBase(BaseModel):
    width: Optional[int] = None
    height: Optional[int] = None
    rotation: Optional[int] = None
    swing_direction: Optional[str] = None
    position_id: Optional[int] = None

class DoorCreate(DoorBase):
    pass

class DoorUpdate(DoorBase):
    pass

class DoorOut(DoorBase):
    model_config = ConfigDict(from_attributes=True)

    door_id: UUID
    room_id: UUID
