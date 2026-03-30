from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.door import DoorCreate, DoorUpdate, DoorOut
from app.controllers import door_controller as ctrl

router = APIRouter(tags=["doors"])


@router.post("/rooms/{room_id}/doors", response_model=DoorOut)
def create_door(room_id: UUID, body: DoorCreate, db: Session = Depends(get_db)):
    d = ctrl.create_door(db, room_id, body)
    return DoorOut.model_validate(d)


@router.get("/rooms/{room_id}/doors", response_model=list[DoorOut])
def list_doors(room_id: UUID, db: Session = Depends(get_db)):
    rows = ctrl.list_doors(db, room_id)
    return [DoorOut.model_validate(x) for x in rows]


@router.patch("/doors/{door_id}", response_model=DoorOut)
def patch_door(door_id: UUID, body: DoorUpdate, db: Session = Depends(get_db)):
    d = ctrl.update_door(db, door_id, body)
    return DoorOut.model_validate(d)


@router.delete("/doors/{door_id}")
def remove_door(door_id: UUID, db: Session = Depends(get_db)):
    ctrl.delete_door(db, door_id)
    return {"ok": True}
