from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.controllers import user_controller as ctrl
from app.api.serialize import user_to_out, room_to_out
from app.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserOut)
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    """Create a new user (registration endpoint, no auth required)"""
    user = ctrl.create_user(db, body)
    return user_to_out(user)


@router.get("/{user_id}/rooms", response_model=list)
def user_rooms(
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get rooms for a user — must be authenticated and viewing own rooms"""
    if user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot view rooms for other users",
        )
    rooms = ctrl.get_user_rooms(db, user_id)
    return [room_to_out(r) for r in rooms]


@router.get("/{user_id}", response_model=UserOut)
def read_user(
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get user profile — must be authenticated and viewing own profile"""
    if user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot view profiles for other users",
        )
    user = ctrl.get_user(db, user_id)
    return user_to_out(user)


@router.patch("/{user_id}", response_model=UserOut)
def patch_user(
    user_id: UUID,
    body: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Update user profile — must be authenticated and updating own profile"""
    if user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update profiles for other users",
        )
    user = ctrl.update_user(db, user_id, body)
    return user_to_out(user)


@router.delete("/{user_id}")
def remove_user(
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Delete user account — must be authenticated and deleting own account"""
    if user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete other user accounts",
        )
    ctrl.delete_user(db, user_id)
    return {"ok": True}
