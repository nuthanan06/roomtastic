from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.room import RoomCreate, RoomUpdate, RoomOut
from app.schemas.inventory import InventoryOut
from app.controllers import room_controller as ctrl
from app.api.serialize import room_to_out

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=RoomOut)
def create_room(body: RoomCreate, db: Session = Depends(get_db)):
    room = ctrl.create_room(db, body)
    return room_to_out(room)


@router.get("/{room_id}", response_model=RoomOut)
def read_room(room_id: UUID, db: Session = Depends(get_db)):
    room = ctrl.get_room(db, room_id)
    return room_to_out(room)


@router.patch("/{room_id}", response_model=RoomOut)
def patch_room(room_id: UUID, body: RoomUpdate, db: Session = Depends(get_db)):
    room = ctrl.update_room(db, room_id, body)
    return room_to_out(room)


@router.delete("/{room_id}")
def remove_room(room_id: UUID, db: Session = Depends(get_db)):
    ctrl.delete_room(db, room_id)
    return {"ok": True}


@router.get("/{room_id}/shopping-list", response_model=list[InventoryOut])
def shopping_list(room_id: UUID, db: Session = Depends(get_db)):
    items = ctrl.get_room_shopping_list(db, room_id)
    return [InventoryOut.model_validate(i) for i in items]
