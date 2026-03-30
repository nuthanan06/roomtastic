from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from .base import Base

class Window(Base):
    __tablename__ = "windows"
    window_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.room_id"))
    position_id = Column(Integer, ForeignKey("positions.id"))
    width = Column(Integer)
    height = Column(Integer)
    sill_height = Column(Integer)
    room = relationship("Room", back_populates="windows")
    position = relationship("Position")
