from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from .base import Base

class Room(Base):
    __tablename__ = "rooms"
    room_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    wall_colour = Column(String)
    is_natural_light = Column(Boolean, default=False)
    width = Column(Integer)
    length = Column(Integer)
    height = Column(Integer)
    last_edited = Column(DateTime)
    user = relationship("User", back_populates="rooms")
    furniture = relationship("Furniture", back_populates="room")
    windows = relationship("Window", back_populates="room")
    doors = relationship("Door", back_populates="room")
