from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.position import Position
from app.schemas.position import PositionCreate, PositionUpdate


def list_positions(db: Session) -> list:
    return db.query(Position).all()


def create_position(db: Session, position_in: PositionCreate) -> Position:
    p = Position(x=position_in.x, y=position_in.y, z=position_in.z)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def get_position(db: Session, position_id: int) -> Position:
    p = db.get(Position, position_id)
    if not p:
        raise HTTPException(status_code=404, detail="Position not found")
    return p


def update_position(db: Session, position_id: int, position_in: PositionUpdate) -> Position:
    p = get_position(db, position_id)
    data = position_in.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def delete_position(db: Session, position_id: int) -> None:
    p = get_position(db, position_id)
    db.delete(p)
    db.commit()
