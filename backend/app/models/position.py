from sqlalchemy import Column, Integer
from .base import Base

class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    x = Column(Integer)
    y = Column(Integer)
    z = Column(Integer)
