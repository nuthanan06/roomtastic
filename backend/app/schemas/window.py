from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID


class WindowBase(BaseModel):
    width: Optional[int] = None
    height: Optional[int] = None
    sill_height: Optional[int] = None
    position_id: Optional[int] = None


class WindowCreate(WindowBase):
    pass


class WindowUpdate(WindowBase):
    pass


class WindowOut(WindowBase):
    model_config = ConfigDict(from_attributes=True)

    window_id: UUID
    room_id: UUID
