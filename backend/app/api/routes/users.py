from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.controllers import user_controller as ctrl
from app.api.serialize import user_to_out, room_to_out

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserOut)
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    user = ctrl.create_user(db, body)
    return user_to_out(user)


@router.get("/{user_id}/rooms", response_model=list)
def user_rooms(user_id: UUID, db: Session = Depends(get_db)):
    rooms = ctrl.get_user_rooms(db, user_id)
    return [room_to_out(r) for r in rooms]


@router.get("/{user_id}", response_model=UserOut)
def read_user(user_id: UUID, db: Session = Depends(get_db)):
    user = ctrl.get_user(db, user_id)
    return user_to_out(user)


@router.patch("/{user_id}", response_model=UserOut)
def patch_user(user_id: UUID, body: UserUpdate, db: Session = Depends(get_db)):
    user = ctrl.update_user(db, user_id, body)
    return user_to_out(user)


@router.delete("/{user_id}")
def remove_user(user_id: UUID, db: Session = Depends(get_db)):
    ctrl.delete_user(db, user_id)
    return {"ok": True}
