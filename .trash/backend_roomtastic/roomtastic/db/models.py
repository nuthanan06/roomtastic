from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from roomtastic.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


class DoorSwingDirection(str, enum.Enum):
    sliding = "Sliding"
    left = "Left"
    right = "Right"


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    account_created: Mapped[datetime] = mapped_column(DateTime, default=_now)
    last_logged_in: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    rooms: Mapped[list["Room"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    room_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.user_id"), index=True)
    is_natural_light: Mapped[bool] = mapped_column(Boolean, default=True)
    wall_color: Mapped[str] = mapped_column(String(50), default="white")
    width: Mapped[int] = mapped_column(Integer, default=0)
    length: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)
    last_edited: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped["User"] = relationship(back_populates="rooms")
    furniture: Mapped[list["FurniturePlacement"]] = relationship(back_populates="room", cascade="all, delete-orphan")
    windows: Mapped[list["Window"]] = relationship(back_populates="room", cascade="all, delete-orphan")
    doors: Mapped[list["Door"]] = relationship(back_populates="room", cascade="all, delete-orphan")
    lights: Mapped[list["Light"]] = relationship(back_populates="room", cascade="all, delete-orphan")


class Inventory(Base):
    __tablename__ = "inventory"

    inventory_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[str] = mapped_column(String(100), index=True, default="Uncategorized")
    width: Mapped[int] = mapped_column(Integer, default=0)
    length: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)
    model_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    colour_options: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    price: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    url_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. "shopify", "ikea", "amazon"
    source_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class FurniturePlacement(Base):
    __tablename__ = "furniture"

    furniture_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    room_id: Mapped[str] = mapped_column(String(36), ForeignKey("rooms.room_id"), index=True)
    inventory_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("inventory.inventory_id"), nullable=True)
    name_of_furniture: Mapped[str] = mapped_column(String(255))
    coordinates: Mapped[dict] = mapped_column(JSON, default=lambda: {"x": 0, "y": 0, "z": 0})
    rotation: Mapped[float] = mapped_column(Float, default=0.0)
    width: Mapped[int] = mapped_column(Integer, default=0)
    length: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    room: Mapped["Room"] = relationship(back_populates="furniture")
    lights: Mapped[list["Light"]] = relationship(back_populates="furniture")


class Light(Base):
    __tablename__ = "lights"

    light_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    room_id: Mapped[str] = mapped_column(String(36), ForeignKey("rooms.room_id"), index=True)
    furniture_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("furniture.furniture_id"), nullable=True)
    type: Mapped[str] = mapped_column(String(100), default="point")
    intensity: Mapped[float] = mapped_column(Float, default=1.0)
    color_temperature: Mapped[int] = mapped_column(Integer, default=4500)
    position: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    room: Mapped["Room"] = relationship(back_populates="lights")
    furniture: Mapped["FurniturePlacement"] = relationship(back_populates="lights")


class Window(Base):
    __tablename__ = "windows"

    window_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    room_id: Mapped[str] = mapped_column(String(36), ForeignKey("rooms.room_id"), index=True)
    position: Mapped[dict] = mapped_column(JSON, default=lambda: {"x": 0, "y": 0, "z": 0})
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)
    sill_height: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    room: Mapped["Room"] = relationship(back_populates="windows")


class Door(Base):
    __tablename__ = "doors"

    door_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    room_id: Mapped[str] = mapped_column(String(36), ForeignKey("rooms.room_id"), index=True)
    position: Mapped[dict] = mapped_column(JSON, default=lambda: {"x": 0, "y": 0, "z": 0})
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)
    rotation: Mapped[float] = mapped_column(Float, default=0.0)
    swing_direction: Mapped[DoorSwingDirection] = mapped_column(
        Enum(DoorSwingDirection), default=DoorSwingDirection.left
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    room: Mapped["Room"] = relationship(back_populates="doors")


class Job(Base):
    __tablename__ = "jobs"

    job_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    type: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.pending, index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
