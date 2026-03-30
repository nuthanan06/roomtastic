from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from .base import Base

class Inventory(Base):
    __tablename__ = "inventory"
    inventory_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    category = Column(String)
    width = Column(Integer)
    length = Column(Integer)
    height = Column(Integer)
    model_url = Column(String)
    thumbnail_url = Column(String)
    colour_options = Column(String)
    price = Column(String)
    description = Column(String)
    url_link = Column(String)
    source = Column(String, nullable=True)
    source_id = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    furnitures = relationship("Furniture", back_populates="inventory")
