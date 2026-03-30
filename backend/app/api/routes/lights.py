from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.lighting_furniture import (
    LightingFurnitureCreate,
    LightingFurnitureUpdate,
    LightingFurnitureOut,
)
from app.controllers import lighting_controller as ctrl

router = APIRouter(tags=["lights"])


@router.post("/rooms/{room_id}/lights", response_model=LightingFurnitureOut)
def create_light(room_id: UUID, body: LightingFurnitureCreate, db: Session = Depends(get_db)):
    light = ctrl.create_lighting_for_room(db, room_id, body)
    return LightingFurnitureOut.model_validate(light)


@router.patch("/lights/{light_id}", response_model=LightingFurnitureOut)
def patch_light(light_id: UUID, body: LightingFurnitureUpdate, db: Session = Depends(get_db)):
    light = ctrl.update_lighting(db, light_id, body)
    return LightingFurnitureOut.model_validate(light)


@router.delete("/lights/{light_id}")
def remove_light(light_id: UUID, db: Session = Depends(get_db)):
    ctrl.delete_lighting(db, light_id)
    return {"ok": True}
