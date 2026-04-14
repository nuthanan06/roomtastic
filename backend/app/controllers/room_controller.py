from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.room import Room
from app.models.user import User
from app.schemas.room import RoomCreate, RoomUpdate


def create_room(db: Session, room_in: RoomCreate) -> Room:
    if not db.get(User, room_in.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    room = Room(
        user_id=room_in.user_id,
        wall_colour=room_in.wall_colour,
        is_natural_light=room_in.is_natural_light or False,
        width=room_in.width,
        length=room_in.length,
        height=room_in.height,
        last_edited=datetime.utcnow(),
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def get_room(db: Session, room_id: UUID) -> Room:
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


def update_room(db: Session, room_id: UUID, room_in: RoomUpdate) -> Room:
    room = get_room(db, room_id)
    data = room_in.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(room, k, v)
    room.last_edited = datetime.utcnow()
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def delete_room(db: Session, room_id: UUID) -> None:
    room = get_room(db, room_id)
    db.delete(room)
    db.commit()


def get_room_shopping_list(db: Session, room_id: UUID) -> list:
    """Placeholder: return inventory items used in room furniture."""
    room = get_room(db, room_id)
    seen = set()
    out = []
    for f in room.furniture:
        if f.inventory_id and f.inventory_id not in seen:
            seen.add(f.inventory_id)
            if f.inventory:
                out.append(f.inventory)
    return out
