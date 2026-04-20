from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.layout import RoomLayoutSyncBody, RoomLayoutSyncOut
from app.schemas.room import RoomCreate, RoomUpdate, RoomOut
from app.schemas.inventory import InventoryOut
from app.controllers import room_controller as ctrl
from app.api.serialize import room_to_out
from app.api.deps import get_current_user

router = APIRouter(prefix="/rooms", tags=["rooms"])


def _check_room_ownership(room_id: UUID, current_user: User, db: Session) -> None:
    """Verify the current user owns the room, raise 403 otherwise."""
    room = ctrl.get_room(db, room_id)
    if room.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access rooms for other users",
        )


@router.post("", response_model=RoomOut)
def create_room(
    body: RoomCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    # Validate ownership before insert so unauthorized rows are never created.
    if body.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create rooms for other users",
        )
    room = ctrl.create_room(db, body)
    return room_to_out(room)


@router.get("/{room_id}", response_model=RoomOut)
def read_room(
    room_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _check_room_ownership(room_id, current_user, db)
    room = ctrl.get_room(db, room_id)
    return room_to_out(room)


@router.patch("/{room_id}", response_model=RoomOut)
def patch_room(
    room_id: UUID,
    body: RoomUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _check_room_ownership(room_id, current_user, db)
    room = ctrl.update_room(db, room_id, body)
    return room_to_out(room)


@router.patch("/{room_id}/layout", response_model=RoomLayoutSyncOut)
def patch_room_layout(
    room_id: UUID,
    body: RoomLayoutSyncBody,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _check_room_ownership(room_id, current_user, db)
    return ctrl.sync_room_layout(db, room_id, body)


@router.delete("/{room_id}")
def remove_room(
    room_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _check_room_ownership(room_id, current_user, db)
    ctrl.delete_room(db, room_id)
    return {"ok": True}


@router.get("/{room_id}/shopping-list", response_model=list[InventoryOut])
def shopping_list(
    room_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    _check_room_ownership(room_id, current_user, db)
    items = ctrl.get_room_shopping_list(db, room_id)
    return [InventoryOut.model_validate(i) for i in items]
