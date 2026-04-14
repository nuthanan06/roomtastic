from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from roomtastic.api.deps import get_current_user
from roomtastic.api.v1.schemas import LightCreate, LightOut, LightUpdate
from roomtastic.db.models import FurniturePlacement, Light, Room, User
from roomtastic.db.session import get_session

router = APIRouter()


def _light_out(l: Light) -> LightOut:
    return LightOut(
        light_id=l.light_id,
        room_id=l.room_id,
        furniture_id=l.furniture_id,
        type=l.type,
        intensity=l.intensity,
        color_temperature=l.color_temperature,
        position=l.position,
        created_at=l.created_at,
        updated_at=l.updated_at,
    )


@router.post("/rooms/{room_id}/lights", response_model=LightOut)
def add_light(
    room_id: str,
    payload: LightCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if payload.furniture_id:
        f = session.get(FurniturePlacement, payload.furniture_id)
        if not f or f.room_id != room_id:
            raise HTTPException(status_code=400, detail="Invalid furniture_id for this room")
    l = Light(
        room_id=room_id,
        furniture_id=payload.furniture_id,
        type=payload.type,
        intensity=payload.intensity,
        color_temperature=payload.color_temperature,
        position=(payload.position.model_dump() if payload.position and hasattr(payload.position, "model_dump") else (payload.position.dict() if payload.position else None)),
        updated_at=datetime.utcnow(),
    )
    session.add(l)
    r.last_edited = datetime.utcnow()
    session.add(r)
    session.commit()
    session.refresh(l)
    return _light_out(l)


@router.patch("/lights/{light_id}", response_model=LightOut)
def update_light(
    light_id: str,
    payload: LightUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    l = session.get(Light, light_id)
    if not l:
        raise HTTPException(status_code=404, detail="Light not found")
    r = session.get(Room, l.room_id)
    if not r or r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    if "position" in data and data["position"] is not None:
        pos = data["position"]
        data["position"] = pos.model_dump() if hasattr(pos, "model_dump") else pos.dict()
    if "furniture_id" in data and data["furniture_id"]:
        f = session.get(FurniturePlacement, data["furniture_id"])
        if not f or f.room_id != l.room_id:
            raise HTTPException(status_code=400, detail="Invalid furniture_id for this room")
    for k, v in data.items():
        setattr(l, k, v)
    l.updated_at = datetime.utcnow()
    r.last_edited = datetime.utcnow()
    session.add_all([l, r])
    session.commit()
    session.refresh(l)
    return _light_out(l)


@router.delete("/lights/{light_id}")
def delete_light(
    light_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    l = session.get(Light, light_id)
    if not l:
        raise HTTPException(status_code=404, detail="Light not found")
    r = session.get(Room, l.room_id)
    if not r or r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    session.delete(l)
    r.last_edited = datetime.utcnow()
    session.add(r)
    session.commit()
    return {"success": True, "deleted": light_id}


@router.get("/rooms/{room_id}/lights")
def list_lights(
    room_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    items = session.execute(select(Light).where(Light.room_id == room_id)).scalars().all()
    return {"lights": [_light_out(i).model_dump() if hasattr(_light_out(i), "model_dump") else _light_out(i).dict() for i in items]}

