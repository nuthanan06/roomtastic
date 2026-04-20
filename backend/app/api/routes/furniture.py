from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.furniture import (
    FurnitureCreate,
    FurnitureUpdate,
    FurnitureOut,
    FurnitureMoveBody,
    FurnitureRotateBody,
)
from app.controllers import furniture_controller as ctrl

router = APIRouter(tags=["furniture"])


@router.post("/rooms/{room_id}/furniture", response_model=FurnitureOut)
def create_furniture(
    room_id: UUID, body: FurnitureCreate, db: Session = Depends(get_db)
):
    """Create a furniture record inside a room from the JSON payload in `body`."""
    f = ctrl.create_furniture(db, room_id, body)
    return FurnitureOut.model_validate(f)


@router.get("/rooms/{room_id}/furniture", response_model=list[FurnitureOut])
def list_furniture(room_id: UUID, db: Session = Depends(get_db)):
    rows = ctrl.list_room_furniture(db, room_id)
    return [FurnitureOut.model_validate(x) for x in rows]


@router.patch("/furniture/{furniture_id}", response_model=FurnitureOut)
def patch_furniture(
    furniture_id: UUID, body: FurnitureUpdate, db: Session = Depends(get_db)
):
    f = ctrl.update_furniture(db, furniture_id, body)
    return FurnitureOut.model_validate(f)


@router.delete("/furniture/{furniture_id}")
def remove_furniture(furniture_id: UUID, db: Session = Depends(get_db)):
    ctrl.delete_furniture(db, furniture_id)
    return {"ok": True}


@router.patch("/furniture/{furniture_id}/move", response_model=FurnitureOut)
def move_furniture_ep(
    furniture_id: UUID, body: FurnitureMoveBody, db: Session = Depends(get_db)
):
    f = ctrl.move_furniture(db, furniture_id, body)
    return FurnitureOut.model_validate(f)


@router.patch("/furniture/{furniture_id}/rotate", response_model=FurnitureOut)
def rotate_furniture_ep(
    furniture_id: UUID, body: FurnitureRotateBody, db: Session = Depends(get_db)
):
    f = ctrl.rotate_furniture(db, furniture_id, body)
    return FurnitureOut.model_validate(f)
