from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.window import Window
from app.models.room import Room
from app.schemas.window import WindowCreate, WindowUpdate


def create_window(db: Session, room_id: UUID, window_in: WindowCreate) -> Window:
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    w = Window(
        room_id=room_id,
        width=window_in.width,
        height=window_in.height,
        sill_height=window_in.sill_height,
        position_id=window_in.position_id,
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


def list_windows(db: Session, room_id: UUID) -> list:
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    return db.query(Window).filter(Window.room_id == room_id).all()


def update_window(db: Session, window_id: UUID, window_in: WindowUpdate) -> Window:
    w = db.get(Window, window_id)
    if not w:
        raise HTTPException(status_code=404, detail="Window not found")
    data = window_in.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(w, k, v)
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


def delete_window(db: Session, window_id: UUID) -> None:
    w = db.get(Window, window_id)
    if not w:
        raise HTTPException(status_code=404, detail="Window not found")
    db.delete(w)
    db.commit()
