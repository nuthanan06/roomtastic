from datetime import datetime

from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from .base import Base


class Furniture(Base):
    __tablename__ = "furniture"
    furniture_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.room_id"))
    inventory_id = Column(UUID(as_uuid=True), ForeignKey("inventory.inventory_id"))
    name_of_furniture = Column(String)
    coordinates = Column(String)  # JSON string
    rotation = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    tags = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    room = relationship("Room", back_populates="furniture")
    inventory = relationship("Inventory", back_populates="furnitures")
    lighting = relationship("LightingFurniture", back_populates="furniture", uselist=False)
