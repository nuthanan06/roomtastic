from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from roomtastic.api.deps import get_current_user
from roomtastic.api.v1.schemas import DoorCreate, DoorOut, DoorUpdate
from roomtastic.db.models import Door, DoorSwingDirection, Room, User
from roomtastic.db.session import get_session

router = APIRouter()


def _door_out(d: Door) -> DoorOut:
    return DoorOut(
        door_id=d.door_id,
        room_id=d.room_id,
        position=d.position,
        width=d.width,
        height=d.height,
        rotation=d.rotation,
        swing_direction=d.swing_direction.value if hasattr(d.swing_direction, "value") else str(d.swing_direction),
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


@router.post("/rooms/{room_id}/doors", response_model=DoorOut)
def add_door(
    room_id: str,
    payload: DoorCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    d = Door(
        room_id=room_id,
        position=payload.position.model_dump() if hasattr(payload.position, "model_dump") else payload.position.dict(),
        width=payload.width,
        height=payload.height,
        rotation=payload.rotation,
        swing_direction=DoorSwingDirection(payload.swing_direction),
        updated_at=datetime.utcnow(),
    )
    session.add(d)
    r.last_edited = datetime.utcnow()
    session.add(r)
    session.commit()
    session.refresh(d)
    return _door_out(d)


@router.get("/rooms/{room_id}/doors")
def list_doors(
    room_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    items = session.execute(select(Door).where(Door.room_id == room_id)).scalars().all()
    return {"doors": [_door_out(i).model_dump() if hasattr(_door_out(i), "model_dump") else _door_out(i).dict() for i in items]}


@router.patch("/doors/{door_id}", response_model=DoorOut)
def update_door(
    door_id: str,
    payload: DoorUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    d = session.get(Door, door_id)
    if not d:
        raise HTTPException(status_code=404, detail="Door not found")
    r = session.get(Room, d.room_id)
    if not r or r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    if "position" in data and data["position"] is not None:
        pos = data["position"]
        data["position"] = pos.model_dump() if hasattr(pos, "model_dump") else pos.dict()
    if "swing_direction" in data and data["swing_direction"] is not None:
        data["swing_direction"] = DoorSwingDirection(data["swing_direction"])
    for k, v in data.items():
        setattr(d, k, v)
    d.updated_at = datetime.utcnow()
    r.last_edited = datetime.utcnow()
    session.add_all([d, r])
    session.commit()
    session.refresh(d)
    return _door_out(d)


@router.delete("/doors/{door_id}")
def delete_door(
    door_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    d = session.get(Door, door_id)
    if not d:
        raise HTTPException(status_code=404, detail="Door not found")
    r = session.get(Room, d.room_id)
    if not r or r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    session.delete(d)
    r.last_edited = datetime.utcnow()
    session.add(r)
    session.commit()
    return {"success": True, "deleted": door_id}

