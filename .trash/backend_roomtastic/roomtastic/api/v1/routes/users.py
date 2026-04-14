from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from roomtastic.api.deps import get_current_user
from roomtastic.api.v1.schemas import UserCreate, UserOut, UserUpdate
from roomtastic.core.security import hash_password
from roomtastic.db.models import User
from roomtastic.db.session import get_session

router = APIRouter()


def _user_out(u: User) -> UserOut:
    return UserOut(
        user_id=u.user_id,
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        account_created=u.account_created,
        last_logged_in=u.last_logged_in,
    )


@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, session: Session = Depends(get_session)):
    existing = session.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")
    u = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        account_created=datetime.utcnow(),
        last_logged_in=None,
    )
    session.add(u)
    session.commit()
    session.refresh(u)
    return _user_out(u)


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    u = session.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_out(u)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    u = session.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.first_name is not None:
        u.first_name = payload.first_name
    if payload.last_name is not None:
        u.last_name = payload.last_name
    session.add(u)
    session.commit()
    session.refresh(u)
    return _user_out(u)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    u = session.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(u)
    session.commit()
    return {"success": True, "deleted": user_id}


@router.get("/{user_id}/rooms")
def list_rooms_for_user(
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    from roomtastic.db.models import Room  # avoid circular import at module import time

    rooms = session.execute(select(Room).where(Room.user_id == user_id)).scalars().all()
    return {
        "rooms": [
            {
                "room_id": r.room_id,
                "user_id": r.user_id,
                "is_natural_light": r.is_natural_light,
                "wall_color": r.wall_color,
                "width": r.width,
                "length": r.length,
                "height": r.height,
                "last_edited": r.last_edited,
            }
            for r in rooms
        ]
    }
