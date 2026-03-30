from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.window import WindowCreate, WindowUpdate, WindowOut
from app.controllers import window_controller as ctrl

router = APIRouter(tags=["windows"])


@router.post("/rooms/{room_id}/windows", response_model=WindowOut)
def create_window(room_id: UUID, body: WindowCreate, db: Session = Depends(get_db)):
    w = ctrl.create_window(db, room_id, body)
    return WindowOut.model_validate(w)


@router.get("/rooms/{room_id}/windows", response_model=list[WindowOut])
def list_windows(room_id: UUID, db: Session = Depends(get_db)):
    rows = ctrl.list_windows(db, room_id)
    return [WindowOut.model_validate(x) for x in rows]


@router.patch("/windows/{window_id}", response_model=WindowOut)
def patch_window(window_id: UUID, body: WindowUpdate, db: Session = Depends(get_db)):
    w = ctrl.update_window(db, window_id, body)
    return WindowOut.model_validate(w)


@router.delete("/windows/{window_id}")
def remove_window(window_id: UUID, db: Session = Depends(get_db)):
    ctrl.delete_window(db, window_id)
    return {"ok": True}
