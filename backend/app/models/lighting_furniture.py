from sqlalchemy import Column, String, Float, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from .base import Base


class LightingFurniture(Base):
    __tablename__ = "lighting_furniture"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    furniture_id = Column(UUID(as_uuid=True), ForeignKey("furniture.furniture_id"))
    type = Column(String)
    intensity = Column(Float)
    color_temperature = Column(Integer)
    furniture = relationship("Furniture", back_populates="lighting")
