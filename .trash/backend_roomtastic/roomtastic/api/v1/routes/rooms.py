from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from roomtastic.api.deps import get_current_user
from roomtastic.api.v1.schemas import RoomCreate, RoomOut, RoomUpdate
from roomtastic.db.models import FurniturePlacement, Inventory, Room, User
from roomtastic.db.session import get_session

router = APIRouter()


def _room_out(r: Room) -> RoomOut:
    return RoomOut(
        room_id=r.room_id,
        user_id=r.user_id,
        is_natural_light=r.is_natural_light,
        wall_color=r.wall_color,
        width=r.width,
        length=r.length,
        height=r.height,
        last_edited=r.last_edited,
    )


@router.post("", response_model=RoomOut)
def create_room(
    payload: RoomCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = Room(
        user_id=current_user.user_id,
        is_natural_light=payload.is_natural_light,
        wall_color=payload.wall_color,
        width=payload.width,
        length=payload.length,
        height=payload.height,
        last_edited=datetime.utcnow(),
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return _room_out(r)


@router.get("/{room_id}")
def get_room(
    room_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Return room plus composed state for 3D rendering.
    from roomtastic.db.models import Door, Light, Window

    furniture = session.execute(select(FurniturePlacement).where(FurniturePlacement.room_id == room_id)).scalars().all()
    windows = session.execute(select(Window).where(Window.room_id == room_id)).scalars().all()
    doors = session.execute(select(Door).where(Door.room_id == room_id)).scalars().all()
    lights = session.execute(select(Light).where(Light.room_id == room_id)).scalars().all()
    return {
        "room": _room_out(r).model_dump() if hasattr(_room_out(r), "model_dump") else _room_out(r).dict(),
        "furniture": [
            {
                "furniture_id": f.furniture_id,
                "room_id": f.room_id,
                "inventory_id": f.inventory_id,
                "name_of_furniture": f.name_of_furniture,
                "coordinates": f.coordinates,
                "rotation": f.rotation,
                "width": f.width,
                "length": f.length,
                "height": f.height,
                "created_at": f.created_at,
                "updated_at": f.updated_at,
            }
            for f in furniture
        ],
        "windows": [
            {
                "window_id": w.window_id,
                "room_id": w.room_id,
                "position": w.position,
                "width": w.width,
                "height": w.height,
                "sill_height": w.sill_height,
                "created_at": w.created_at,
                "updated_at": w.updated_at,
            }
            for w in windows
        ],
        "doors": [
            {
                "door_id": d.door_id,
                "room_id": d.room_id,
                "position": d.position,
                "width": d.width,
                "height": d.height,
                "rotation": d.rotation,
                "swing_direction": d.swing_direction.value if hasattr(d.swing_direction, "value") else str(d.swing_direction),
                "created_at": d.created_at,
                "updated_at": d.updated_at,
            }
            for d in doors
        ],
        "lights": [
            {
                "light_id": l.light_id,
                "room_id": l.room_id,
                "furniture_id": l.furniture_id,
                "type": l.type,
                "intensity": l.intensity,
                "color_temperature": l.color_temperature,
                "position": l.position,
                "created_at": l.created_at,
                "updated_at": l.updated_at,
            }
            for l in lights
        ],
    }


@router.patch("/{room_id}", response_model=RoomOut)
def update_room(
    room_id: str,
    payload: RoomUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    for k, v in payload.model_dump(exclude_unset=True).items() if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True).items():
        setattr(r, k, v)
    r.last_edited = datetime.utcnow()
    session.add(r)
    session.commit()
    session.refresh(r)
    return _room_out(r)


@router.delete("/{room_id}")
def delete_room(
    room_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    session.delete(r)
    session.commit()
    return {"success": True, "deleted": room_id}


@router.get("/{room_id}/shopping-list")
def shopping_list(
    room_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    r = session.get(Room, room_id)
    if not r:
        raise HTTPException(status_code=404, detail="Room not found")
    if r.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    furniture = session.execute(select(FurniturePlacement).where(FurniturePlacement.room_id == room_id)).scalars().all()
    # Aggregate inventory-backed furniture into a buy list.
    counts: dict[str, int] = {}
    for f in furniture:
        if f.inventory_id:
            counts[f.inventory_id] = counts.get(f.inventory_id, 0) + 1
    items = []
    if counts:
        inv = session.execute(select(Inventory).where(Inventory.inventory_id.in_(list(counts.keys())))).scalars().all()
        inv_by_id = {i.inventory_id: i for i in inv}
        for iid, qty in counts.items():
            i = inv_by_id.get(iid)
            if not i:
                continue
            items.append(
                {
                    "inventory_id": iid,
                    "name": i.name,
                    "category": i.category,
                    "price": i.price,
                    "url_link": i.url_link,
                    "thumbnail_url": i.thumbnail_url,
                    "quantity": qty,
                }
            )
    return {"room_id": room_id, "items": items}

