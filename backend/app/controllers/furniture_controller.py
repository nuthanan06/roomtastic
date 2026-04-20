import json
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.furniture import Furniture
from app.models.room import Room
from app.schemas.furniture import (
    FurnitureCreate,
    FurnitureUpdate,
    FurnitureMoveBody,
    FurnitureRotateBody,
)


def _normalize_tags(raw: list[str] | None) -> list[str]:
    if not raw:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for tag in raw:
        t = (tag or "").strip().lower()
        if not t or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def _coords_dict(s: str | None) -> dict:
    if not s:
        return {"x": 0.0, "y": 0.0, "z": 0.0}
    try:
        d = json.loads(s)
        if isinstance(d, dict):
            return {
                "x": float(d.get("x", 0)),
                "y": float(d.get("y", 0)),
                "z": float(d.get("z", 0)),
            }
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    return {"x": 0.0, "y": 0.0, "z": 0.0}


def _dump_coords(d: dict) -> str:
    return json.dumps(d)


def create_furniture(
    db: Session, room_id: UUID, furniture_in: FurnitureCreate
) -> Furniture:
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    coords = furniture_in.coordinates or '{"x":0,"y":0,"z":0}'
    now = datetime.utcnow()
    f = Furniture(
        room_id=room_id,
        inventory_id=furniture_in.inventory_id,
        name_of_furniture=furniture_in.name_of_furniture or "Item",
        coordinates=coords,
        rotation=furniture_in.rotation or 0,
        width=furniture_in.width or 0,
        height=furniture_in.height or 0,
        tags=_normalize_tags(furniture_in.tags),
        created_at=now,
        updated_at=now,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def list_room_furniture(db: Session, room_id: UUID) -> list:
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    return db.query(Furniture).filter(Furniture.room_id == room_id).all()


def get_furniture_one(db: Session, furniture_id: UUID) -> Furniture:
    f = db.get(Furniture, furniture_id)
    if not f:
        raise HTTPException(status_code=404, detail="Furniture not found")
    return f


def update_furniture(
    db: Session, furniture_id: UUID, furniture_in: FurnitureUpdate
) -> Furniture:
    f = get_furniture_one(db, furniture_id)
    data = furniture_in.model_dump(exclude_unset=True)
    if "tags" in data:
        data["tags"] = _normalize_tags(data.get("tags"))
    for k, v in data.items():
        setattr(f, k, v)
    f.updated_at = datetime.utcnow()
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def delete_furniture(db: Session, furniture_id: UUID) -> None:
    f = get_furniture_one(db, furniture_id)
    db.delete(f)
    db.commit()


def move_furniture(
    db: Session, furniture_id: UUID, body: FurnitureMoveBody
) -> Furniture:
    f = get_furniture_one(db, furniture_id)
    c = _coords_dict(f.coordinates)
    if body.x is not None:
        c["x"] = body.x
    if body.y is not None:
        c["y"] = body.y
    if body.z is not None:
        c["z"] = body.z
    f.coordinates = _dump_coords(c)
    f.updated_at = datetime.utcnow()
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def rotate_furniture(
    db: Session, furniture_id: UUID, body: FurnitureRotateBody
) -> Furniture:
    f = get_furniture_one(db, furniture_id)
    f.rotation = body.rotation
    f.updated_at = datetime.utcnow()
    db.add(f)
    db.commit()
    db.refresh(f)
    return f
