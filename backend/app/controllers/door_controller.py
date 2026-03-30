from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.door import Door
from app.models.room import Room
from app.schemas.door import DoorCreate, DoorUpdate


def create_door(db: Session, room_id: UUID, door_in: DoorCreate) -> Door:
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    d = Door(
        room_id=room_id,
        width=door_in.width,
        height=door_in.height,
        rotation=door_in.rotation,
        swing_direction=door_in.swing_direction,
        position_id=door_in.position_id,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def list_doors(db: Session, room_id: UUID) -> list:
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    return db.query(Door).filter(Door.room_id == room_id).all()


def update_door(db: Session, door_id: UUID, door_in: DoorUpdate) -> Door:
    d = db.get(Door, door_id)
    if not d:
        raise HTTPException(status_code=404, detail="Door not found")
    data = door_in.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(d, k, v)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def delete_door(db: Session, door_id: UUID) -> None:
    d = db.get(Door, door_id)
    if not d:
        raise HTTPException(status_code=404, detail="Door not found")
    db.delete(d)
    db.commit()
