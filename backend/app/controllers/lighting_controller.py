from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.furniture import Furniture
from app.models.lighting_furniture import LightingFurniture
from app.models.room import Room
from app.schemas.lighting_furniture import LightingFurnitureCreate, LightingFurnitureUpdate


def create_lighting_for_room(
    db: Session, room_id: UUID, body: LightingFurnitureCreate
) -> LightingFurniture:
    if not db.get(Room, room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    if not body.furniture_id:
        raise HTTPException(status_code=400, detail="furniture_id is required")
    furn = db.get(Furniture, body.furniture_id)
    if not furn or furn.room_id != room_id:
        raise HTTPException(status_code=400, detail="Furniture not in this room")
    existing = (
        db.query(LightingFurniture)
        .filter(LightingFurniture.furniture_id == body.furniture_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Lighting already exists for this furniture")
    light = LightingFurniture(
        furniture_id=body.furniture_id,
        type=body.type,
        intensity=body.intensity,
        color_temperature=body.color_temperature,
    )
    db.add(light)
    db.commit()
    db.refresh(light)
    return light


def update_lighting(db: Session, light_id: UUID, body: LightingFurnitureUpdate) -> LightingFurniture:
    light = db.get(LightingFurniture, light_id)
    if not light:
        raise HTTPException(status_code=404, detail="Light not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(light, k, v)
    db.add(light)
    db.commit()
    db.refresh(light)
    return light


def delete_lighting(db: Session, light_id: UUID) -> None:
    light = db.get(LightingFurniture, light_id)
    if not light:
        raise HTTPException(status_code=404, detail="Light not found")
    db.delete(light)
    db.commit()
