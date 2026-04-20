from sqlalchemy import Column, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from .base import Base


class Opening(Base):
    __tablename__ = "openings"

    opening_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.room_id"), nullable=False)
    kind = Column(String, nullable=False)  # door | window
    wall = Column(String, nullable=False)  # pz | nz | px | nx
    t = Column(Float, nullable=False)
    width_m = Column(Float, nullable=False)
    height_m = Column(Float, nullable=False)
    sill_m = Column(Float, nullable=False, default=0.0)

    room = relationship("Room", back_populates="openings")
