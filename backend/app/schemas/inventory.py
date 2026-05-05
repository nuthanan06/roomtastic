from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class InventoryBase(BaseModel):
    name: str
    category: Optional[str] = None
    user_id: Optional[UUID] = None
    width: Optional[int] = None
    length: Optional[int] = None
    height: Optional[int] = None
    model_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    colour_options: Optional[str] = None
    price: Optional[str] = None
    description: Optional[str] = None
    url_link: Optional[str] = None
    source: Optional[str] = None
    source_id: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class InventoryCreate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    user_id: Optional[UUID] = None
    width: Optional[int] = None
    length: Optional[int] = None
    height: Optional[int] = None
    model_url: Optional[str] = None
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class InventoryUpdate(InventoryBase):
    name: Optional[str] = None
    category: Optional[str] = None
    user_id: Optional[UUID] = None
    width: Optional[int] = None
    length: Optional[int] = None
    height: Optional[int] = None
    model_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    colour_options: Optional[str] = None
    price: Optional[str] = None
    description: Optional[str] = None
    url_link: Optional[str] = None
    source: Optional[str] = None
    source_id: Optional[str] = None
    tags: Optional[list[str]] = None


class InventoryOut(InventoryBase):
    model_config = ConfigDict(from_attributes=True)

    inventory_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
