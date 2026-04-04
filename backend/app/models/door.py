from sqlalchemy import Column, Integer, String, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from .base import Base

class Door(Base):
    __tablename__ = "doors"
    door_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.room_id"))
    position_id = Column(Integer, ForeignKey("positions.id"))
    width = Column(Integer)
    height = Column(Integer)
    rotation = Column(Integer)
    swing_direction = Column(String)  # ENUM: Sliding, Left, Right
    room = relationship("Room", back_populates="doors")
    position = relationship("Position")
