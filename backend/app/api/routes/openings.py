from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.controllers import openings_controller as ctrl
from app.db.session import get_db
from app.schemas.opening import OpeningCreate, OpeningOut, OpeningUpdate

router = APIRouter(tags=["openings"])


@router.post("/rooms/{room_id}/openings", response_model=OpeningOut)
def create_opening(room_id: UUID, body: OpeningCreate, db: Session = Depends(get_db)):
    row = ctrl.create_opening(db, room_id, body)
    return OpeningOut.model_validate(row)


@router.get("/rooms/{room_id}/openings", response_model=list[OpeningOut])
def list_openings(room_id: UUID, db: Session = Depends(get_db)):
    rows = ctrl.list_openings(db, room_id)
    return [OpeningOut.model_validate(x) for x in rows]


@router.patch("/openings/{opening_id}", response_model=OpeningOut)
def patch_opening(opening_id: UUID, body: OpeningUpdate, db: Session = Depends(get_db)):
    row = ctrl.update_opening(db, opening_id, body)
    return OpeningOut.model_validate(row)


@router.delete("/openings/{opening_id}")
def remove_opening(opening_id: UUID, db: Session = Depends(get_db)):
    ctrl.delete_opening(db, opening_id)
    return {"ok": True}
