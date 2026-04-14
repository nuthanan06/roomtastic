from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class Position(BaseModel):
    x: float = 0
    y: float = 0
    z: float = 0


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None


class UserOut(BaseModel):
    user_id: str
    first_name: str
    last_name: str
    email: str
    account_created: datetime
    last_logged_in: datetime | None


class AuthLogin(BaseModel):
    email: str
    password: str


class AuthToken(BaseModel):
    token: str
    user: UserOut


class RoomCreate(BaseModel):
    width: int = 0
    length: int = 0
    height: int = 0
    wall_color: str = "white"
    is_natural_light: bool = True


class RoomUpdate(BaseModel):
    width: int | None = None
    length: int | None = None
    height: int | None = None
    wall_color: str | None = None
    is_natural_light: bool | None = None


class RoomOut(BaseModel):
    room_id: str
    user_id: str
    is_natural_light: bool
    wall_color: str
    width: int
    length: int
    height: int
    last_edited: datetime


class InventoryCreate(BaseModel):
    name: str
    category: str = "Uncategorized"
    width: int = 0
    length: int = 0
    height: int = 0
    model_url: str | None = None
    thumbnail_url: str | None = None
    colour_options: list[str] | None = None
    price: str | None = None
    description: str | None = None
    url_link: str | None = None
    source: str | None = None
    source_id: str | None = None


class InventoryUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    width: int | None = None
    length: int | None = None
    height: int | None = None
    model_url: str | None = None
    thumbnail_url: str | None = None
    colour_options: list[str] | None = None
    price: str | None = None
    description: str | None = None
    url_link: str | None = None
    source: str | None = None
    source_id: str | None = None


class InventoryOut(BaseModel):
    inventory_id: str
    name: str
    category: str
    width: int
    length: int
    height: int
    model_url: str | None
    thumbnail_url: str | None
    colour_options: list[str] | None
    price: str | None
    description: str | None
    url_link: str | None
    source: str | None
    source_id: str | None
    created_at: datetime
    updated_at: datetime


class FurnitureCreate(BaseModel):
    inventory_id: str | None = None
    name_of_furniture: str | None = None
    coordinates: Position = Field(default_factory=Position)
    rotation: float = 0
    width: int | None = None
    length: int | None = None
    height: int | None = None


class FurnitureUpdate(BaseModel):
    name_of_furniture: str | None = None
    coordinates: Position | None = None
    rotation: float | None = None
    width: int | None = None
    length: int | None = None
    height: int | None = None


class FurnitureOut(BaseModel):
    furniture_id: str
    room_id: str
    inventory_id: str | None
    name_of_furniture: str
    coordinates: dict[str, Any]
    rotation: float
    width: int
    length: int
    height: int
    created_at: datetime
    updated_at: datetime


class LightCreate(BaseModel):
    furniture_id: str | None = None
    type: str = "point"
    intensity: float = 1.0
    color_temperature: int = 4500
    position: Position | None = None


class LightUpdate(BaseModel):
    type: str | None = None
    intensity: float | None = None
    color_temperature: int | None = None
    position: Position | None = None
    furniture_id: str | None = None


class LightOut(BaseModel):
    light_id: str
    room_id: str
    furniture_id: str | None
    type: str
    intensity: float
    color_temperature: int
    position: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class WindowCreate(BaseModel):
    position: Position = Field(default_factory=Position)
    width: int = 0
    height: int = 0
    sill_height: int = 0


class WindowUpdate(BaseModel):
    position: Position | None = None
    width: int | None = None
    height: int | None = None
    sill_height: int | None = None


class WindowOut(BaseModel):
    window_id: str
    room_id: str
    position: dict[str, Any]
    width: int
    height: int
    sill_height: int
    created_at: datetime
    updated_at: datetime


class DoorCreate(BaseModel):
    position: Position = Field(default_factory=Position)
    width: int = 0
    height: int = 0
    rotation: float = 0
    swing_direction: Literal["Sliding", "Left", "Right"] = "Left"


class DoorUpdate(BaseModel):
    position: Position | None = None
    width: int | None = None
    height: int | None = None
    rotation: float | None = None
    swing_direction: Literal["Sliding", "Left", "Right"] | None = None


class DoorOut(BaseModel):
    door_id: str
    room_id: str
    position: dict[str, Any]
    width: int
    height: int
    rotation: float
    swing_direction: str
    created_at: datetime
    updated_at: datetime


class JobOut(BaseModel):
    job_id: str
    type: str
    status: str
    payload: dict[str, Any]
    result: dict[str, Any] | None
    error: str | None
    attempts: int
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    updated_at: datetime


class RoomChatRequest(BaseModel):
    room_id: str
    message: str
