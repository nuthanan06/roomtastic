from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.opening import Opening
from app.models.room import Room
from app.schemas.opening import OpeningCreate, OpeningUpdate


def _ensure_room(db: Session, room_id: UUID) -> None:
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")


def create_opening(db: Session, room_id: UUID, opening_in: OpeningCreate) -> Opening:
    _ensure_room(db, room_id)
    obj = Opening(room_id=room_id, **opening_in.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def list_openings(db: Session, room_id: UUID) -> list[Opening]:
    _ensure_room(db, room_id)
    return db.query(Opening).filter(Opening.room_id == room_id).all()


def update_opening(db: Session, opening_id: UUID, opening_in: OpeningUpdate) -> Opening:
    obj = db.get(Opening, opening_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Opening not found")
    data = opening_in.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete_opening(db: Session, opening_id: UUID) -> None:
    obj = db.get(Opening, opening_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Opening not found")
    db.delete(obj)
    db.commit()
