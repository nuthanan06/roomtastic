from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.position import PositionCreate, PositionUpdate, PositionOut
from app.controllers import position_controller as ctrl

router = APIRouter(prefix="/positions", tags=["positions"])


@router.get("", response_model=list[PositionOut])
def list_positions_ep(db: Session = Depends(get_db)):
    rows = ctrl.list_positions(db)
    return [PositionOut.model_validate(x) for x in rows]


@router.post("", response_model=PositionOut)
def create_position(body: PositionCreate, db: Session = Depends(get_db)):
    p = ctrl.create_position(db, body)
    return PositionOut.model_validate(p)


@router.get("/{position_id}", response_model=PositionOut)
def read_position(position_id: int, db: Session = Depends(get_db)):
    p = ctrl.get_position(db, position_id)
    return PositionOut.model_validate(p)


@router.patch("/{position_id}", response_model=PositionOut)
def patch_position(
    position_id: int, body: PositionUpdate, db: Session = Depends(get_db)
):
    p = ctrl.update_position(db, position_id, body)
    return PositionOut.model_validate(p)


@router.delete("/{position_id}")
def remove_position(position_id: int, db: Session = Depends(get_db)):
    ctrl.delete_position(db, position_id)
    return {"ok": True}
