from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from roomtastic.api.deps import get_current_user
from roomtastic.api.v1.schemas import InventoryCreate, InventoryOut, InventoryUpdate
from roomtastic.db.models import Inventory, User
from roomtastic.db.session import get_session

router = APIRouter()


def _inv_out(i: Inventory) -> InventoryOut:
    return InventoryOut(
        inventory_id=i.inventory_id,
        name=i.name,
        category=i.category,
        width=i.width,
        length=i.length,
        height=i.height,
        model_url=i.model_url,
        thumbnail_url=i.thumbnail_url,
        colour_options=i.colour_options,
        price=i.price,
        description=i.description,
        url_link=i.url_link,
        source=i.source,
        source_id=i.source_id,
        created_at=i.created_at,
        updated_at=i.updated_at,
    )


@router.get("", response_model=None)
def list_inventory(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    source: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Inventory is global in this initial model; auth just gates access.
    where = []
    if q:
        like = f"%{q}%"
        where.append(or_(Inventory.name.ilike(like), Inventory.description.ilike(like)))
    if category:
        where.append(Inventory.category == category)
    if source:
        where.append(Inventory.source == source)
    stmt = select(Inventory)
    if where:
        stmt = stmt.where(and_(*where))
    stmt = stmt.order_by(Inventory.updated_at.desc()).offset(offset).limit(limit)
    items = session.execute(stmt).scalars().all()
    return {
        "inventory": [
            _inv_out(i).model_dump() if hasattr(_inv_out(i), "model_dump") else _inv_out(i).dict() for i in items
        ],
        "limit": limit,
        "offset": offset,
    }


@router.get("/{inventory_id}", response_model=InventoryOut)
def get_inventory_item(
    inventory_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    i = session.get(Inventory, inventory_id)
    if not i:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return _inv_out(i)


@router.post("", response_model=InventoryOut)
def create_inventory_item(
    payload: InventoryCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    i = Inventory(
        name=payload.name,
        category=payload.category,
        width=payload.width,
        length=payload.length,
        height=payload.height,
        model_url=payload.model_url,
        thumbnail_url=payload.thumbnail_url,
        colour_options=payload.colour_options,
        price=payload.price,
        description=payload.description,
        url_link=payload.url_link,
        source=payload.source,
        source_id=payload.source_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(i)
    session.commit()
    session.refresh(i)
    return _inv_out(i)


@router.patch("/{inventory_id}", response_model=InventoryOut)
def update_inventory_item(
    inventory_id: str,
    payload: InventoryUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    i = session.get(Inventory, inventory_id)
    if not i:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(i, k, v)
    i.updated_at = datetime.utcnow()
    session.add(i)
    session.commit()
    session.refresh(i)
    return _inv_out(i)


@router.delete("/{inventory_id}")
def delete_inventory_item(
    inventory_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    i = session.get(Inventory, inventory_id)
    if not i:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    session.delete(i)
    session.commit()
    return {"success": True, "deleted": inventory_id}

