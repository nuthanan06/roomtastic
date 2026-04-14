from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from roomtastic.api.deps import get_current_user
from roomtastic.api.v1.schemas import FurnitureCreate, FurnitureOut, FurnitureUpdate
from roomtastic.db.models import FurniturePlacement, Inventory, Room, User
from roomtastic.db.session import get_session

router = APIRouter()


def _furniture_out(f: FurniturePlacement) -> FurnitureOut:
    return FurnitureOut(
        furniture_id=f.furniture_id,
        room_id=f.room_id,
        inventory_id=f.inventory_id,
        name_of_furniture=f.name_of_furniture,
        coordinates=f.coordinates,
        rotation=f.rotation,
        width=f.width,
        length=f.length,
        height=f.height,
        created_at=f.created_at,
        updated_at=f.updated_at,
    )


@router.post("/rooms/{room_id}/furniture", response_model=FurnitureOut)
def add_furniture_to_room(
    room_id: str,
    payload: FurnitureCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    name = payload.name_of_furniture
    width = payload.width
    length = payload.length
    height = payload.height
    if payload.inventory_id:
        inv = session.get(Inventory, payload.inventory_id)
        if not inv:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        name = name or inv.name
        width = width if width is not None else inv.width
        length = length if length is not None else inv.length
        height = height if height is not None else inv.height
    if not name:
        raise HTTPException(status_code=400, detail="name_of_furniture is required (or provide inventory_id)")

    f = FurniturePlacement(
        room_id=room_id,
        inventory_id=payload.inventory_id,
        name_of_furniture=name,
        coordinates=payload.coordinates.model_dump() if hasattr(payload.coordinates, "model_dump") else payload.coordinates.dict(),
        rotation=payload.rotation,
        width=int(width or 0),
        length=int(length or 0),
        height=int(height or 0),
        updated_at=datetime.utcnow(),
    )
    session.add(f)
    r.last_edited = datetime.utcnow()
    session.add(r)
    session.commit()
    session.refresh(f)
    return _furniture_out(f)


@router.get("/rooms/{room_id}/furniture")
def list_furniture_in_room(
    room_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    items = session.execute(select(FurniturePlacement).where(FurniturePlacement.room_id == room_id)).scalars().all()
    return {"furniture": [_furniture_out(f).model_dump() if hasattr(_furniture_out(f), "model_dump") else _furniture_out(f).dict() for f in items]}


@router.patch("/furniture/{furniture_id}", response_model=FurnitureOut)
def update_furniture(
    furniture_id: str,
    payload: FurnitureUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    f = session.get(FurniturePlacement, furniture_id)
    if not f:
        raise HTTPException(status_code=404, detail="Furniture not found")
    r = session.get(Room, f.room_id)
    if not r or r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    if "coordinates" in data and data["coordinates"] is not None:
        coords = data["coordinates"]
        data["coordinates"] = coords.model_dump() if hasattr(coords, "model_dump") else coords.dict()
    for k, v in data.items():
        setattr(f, k, v)
    f.updated_at = datetime.utcnow()
    r.last_edited = datetime.utcnow()
    session.add_all([f, r])
    session.commit()
    session.refresh(f)
    return _furniture_out(f)


@router.delete("/furniture/{furniture_id}")
def delete_furniture(
    furniture_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    f = session.get(FurniturePlacement, furniture_id)
    if not f:
        raise HTTPException(status_code=404, detail="Furniture not found")
    r = session.get(Room, f.room_id)
    if not r or r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    session.delete(f)
    r.last_edited = datetime.utcnow()
    session.add(r)
    session.commit()
    return {"success": True, "deleted": furniture_id}


@router.patch("/furniture/{furniture_id}/move", response_model=FurnitureOut)
def move_furniture(
    furniture_id: str,
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Expected: { "coordinates": { "x": ..., "y": ..., "z": ... } }
    f = session.get(FurniturePlacement, furniture_id)
    if not f:
        raise HTTPException(status_code=404, detail="Furniture not found")
    r = session.get(Room, f.room_id)
    if not r or r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    coords = payload.get("coordinates")
    if not isinstance(coords, dict) or not all(k in coords for k in ("x", "y", "z")):
        raise HTTPException(status_code=400, detail="coordinates must be an object with x,y,z")
    f.coordinates = {"x": coords["x"], "y": coords["y"], "z": coords["z"]}
    f.updated_at = datetime.utcnow()
    r.last_edited = datetime.utcnow()
    session.add_all([f, r])
    session.commit()
    session.refresh(f)
    return _furniture_out(f)


@router.patch("/furniture/{furniture_id}/rotate", response_model=FurnitureOut)
def rotate_furniture(
    furniture_id: str,
    payload: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Expected: { "rotation": <number> }
    f = session.get(FurniturePlacement, furniture_id)
    if not f:
        raise HTTPException(status_code=404, detail="Furniture not found")
    r = session.get(Room, f.room_id)
    if not r or r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    rot = payload.get("rotation")
    if rot is None:
        raise HTTPException(status_code=400, detail="rotation is required")
    try:
        f.rotation = float(rot)
    except Exception:
        raise HTTPException(status_code=400, detail="rotation must be a number")
    f.updated_at = datetime.utcnow()
    r.last_edited = datetime.utcnow()
    session.add_all([f, r])
    session.commit()
    session.refresh(f)
    return _furniture_out(f)

