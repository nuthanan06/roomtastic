from datetime import datetime
import json
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.furniture import Furniture
from app.models.opening import Opening
from app.models.room import Room
from app.models.user import User
from app.schemas.layout import (
    LayoutFurnitureResult,
    LayoutOpeningResult,
    RoomLayoutSyncBody,
    RoomLayoutSyncOut,
)
from app.schemas.room import RoomCreate, RoomUpdate


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


def _looks_like_uuid(s: str | None) -> bool:
    if not s:
        return False
    try:
        UUID(str(s))
        return True
    except (ValueError, TypeError):
        return False


def create_room(db: Session, room_in: RoomCreate) -> Room:
    if not db.get(User, room_in.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    room = Room(
        user_id=room_in.user_id,
        wall_colour=room_in.wall_colour,
        is_natural_light=room_in.is_natural_light or False,
        width=room_in.width,
        length=room_in.length,
        height=room_in.height,
        last_edited=datetime.utcnow(),
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def get_room(db: Session, room_id: UUID) -> Room:
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


def update_room(db: Session, room_id: UUID, room_in: RoomUpdate) -> Room:
    room = get_room(db, room_id)
    data = room_in.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(room, k, v)
    room.last_edited = datetime.utcnow()
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def delete_room(db: Session, room_id: UUID) -> None:
    room = get_room(db, room_id)
    db.delete(room)
    db.commit()


def get_room_shopping_list(db: Session, room_id: UUID) -> list:
    """Placeholder: return inventory items used in room furniture."""
    room = get_room(db, room_id)
    seen = set()
    out = []
    for f in room.furniture:
        if f.inventory_id and f.inventory_id not in seen:
            seen.add(f.inventory_id)
            if f.inventory:
                out.append(f.inventory)
    return out


def sync_room_layout(db: Session, room_id: UUID, body: RoomLayoutSyncBody) -> RoomLayoutSyncOut:
    room = get_room(db, room_id)

    if body.room_patch is not None:
        patch = body.room_patch.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(room, k, v)

    existing_furniture = {f.furniture_id: f for f in room.furniture}
    keep_furniture_ids: set[UUID] = set()
    furniture_results: list[LayoutFurnitureResult] = []

    for item in body.furniture:
        target: Furniture | None = None
        if item.furniture_id:
            target = existing_furniture.get(item.furniture_id)
            if not target:
                raise HTTPException(status_code=400, detail="Invalid furniture_id for this room")

        if target is None:
            target = Furniture(
                room_id=room_id,
                inventory_id=item.inventory_id,
                name_of_furniture=item.name_of_furniture or "Item",
                coordinates=item.coordinates or '{"x":0,"y":0,"z":0,"scale":1}',
                rotation=item.rotation or 0,
                tags=_normalize_tags(item.tags),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(target)
            db.flush()
        else:
            target.inventory_id = item.inventory_id
            if item.name_of_furniture is not None:
                target.name_of_furniture = item.name_of_furniture
            if item.coordinates is not None:
                try:
                    json.loads(item.coordinates)
                    target.coordinates = item.coordinates
                except (json.JSONDecodeError, TypeError):
                    raise HTTPException(status_code=400, detail="Invalid coordinates JSON")
            if item.rotation is not None:
                target.rotation = item.rotation
            target.tags = _normalize_tags(item.tags)
            target.updated_at = datetime.utcnow()

        keep_furniture_ids.add(target.furniture_id)
        furniture_results.append(
            LayoutFurnitureResult(client_id=item.client_id, furniture_id=target.furniture_id)
        )

    for f in list(room.furniture):
        if f.furniture_id not in keep_furniture_ids:
            db.delete(f)

    existing_openings = {o.opening_id: o for o in room.openings}
    keep_opening_ids: set[UUID] = set()
    opening_results: list[LayoutOpeningResult] = []

    for item in body.openings:
        wall = item.wall.strip().lower()
        if wall not in {"pz", "nz", "px", "nx"}:
            raise HTTPException(status_code=400, detail="Opening wall must be one of pz,nz,px,nx")
        if not (0.0 <= item.t <= 1.0):
            raise HTTPException(status_code=400, detail="Opening t must be between 0 and 1")

        target_opening: Opening | None = None
        if item.opening_id:
            target_opening = existing_openings.get(item.opening_id)
            if not target_opening:
                raise HTTPException(status_code=400, detail="Invalid opening_id for this room")
        elif _looks_like_uuid(item.client_id):
            cid = UUID(str(item.client_id))
            target_opening = existing_openings.get(cid)

        if target_opening is None:
            target_opening = Opening(room_id=room_id)
            db.add(target_opening)
            db.flush()

        target_opening.kind = item.kind
        target_opening.wall = wall
        target_opening.t = item.t
        target_opening.width_m = item.width_m
        target_opening.height_m = item.height_m
        target_opening.sill_m = item.sill_m

        keep_opening_ids.add(target_opening.opening_id)
        opening_results.append(
            LayoutOpeningResult(
                client_id=item.client_id,
                opening_id=target_opening.opening_id,
                kind=item.kind,
            )
        )

    for o in list(room.openings):
        if o.opening_id not in keep_opening_ids:
            db.delete(o)

    room.last_edited = datetime.utcnow()
    db.add(room)
    db.commit()

    return RoomLayoutSyncOut(
        room_id=room_id,
        furniture=furniture_results,
        openings=opening_results,
    )
