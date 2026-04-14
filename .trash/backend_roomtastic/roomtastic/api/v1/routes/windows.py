from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from roomtastic.api.deps import get_current_user
from roomtastic.api.v1.schemas import WindowCreate, WindowOut, WindowUpdate
from roomtastic.db.models import Room, User, Window
from roomtastic.db.session import get_session

router = APIRouter()


def _window_out(w: Window) -> WindowOut:
    return WindowOut(
        window_id=w.window_id,
        room_id=w.room_id,
        position=w.position,
        width=w.width,
        height=w.height,
        sill_height=w.sill_height,
        created_at=w.created_at,
        updated_at=w.updated_at,
    )


@router.post("/rooms/{room_id}/windows", response_model=WindowOut)
def add_window(
    room_id: str,
    payload: WindowCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    w = Window(
        room_id=room_id,
        position=payload.position.model_dump() if hasattr(payload.position, "model_dump") else payload.position.dict(),
        width=payload.width,
        height=payload.height,
        sill_height=payload.sill_height,
        updated_at=datetime.utcnow(),
    )
    session.add(w)
    r.last_edited = datetime.utcnow()
    session.add(r)
    session.commit()
    session.refresh(w)
    return _window_out(w)


@router.get("/rooms/{room_id}/windows")
def list_windows(
    room_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    items = session.execute(select(Window).where(Window.room_id == room_id)).scalars().all()
    return {"windows": [_window_out(i).model_dump() if hasattr(_window_out(i), "model_dump") else _window_out(i).dict() for i in items]}


@router.patch("/windows/{window_id}", response_model=WindowOut)
def update_window(
    window_id: str,
    payload: WindowUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    w = session.get(Window, window_id)
    if not w:
        raise HTTPException(status_code=404, detail="Window not found")
    r = session.get(Room, w.room_id)
    if not r or r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    if "position" in data and data["position"] is not None:
        pos = data["position"]
        data["position"] = pos.model_dump() if hasattr(pos, "model_dump") else pos.dict()
    for k, v in data.items():
        setattr(w, k, v)
    w.updated_at = datetime.utcnow()
    r.last_edited = datetime.utcnow()
    session.add_all([w, r])
    session.commit()
    session.refresh(w)
    return _window_out(w)


@router.delete("/windows/{window_id}")
def delete_window(
    window_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    w = session.get(Window, window_id)
    if not w:
        raise HTTPException(status_code=404, detail="Window not found")
    r = session.get(Room, w.room_id)
    if not r or r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    session.delete(w)
    r.last_edited = datetime.utcnow()
    session.add(r)
    session.commit()
    return {"success": True, "deleted": window_id}

