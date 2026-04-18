from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.inventory import Inventory
from app.schemas.inventory import InventoryCreate, InventoryUpdate


def list_inventory(db: Session) -> list:
    return db.query(Inventory).order_by(Inventory.updated_at.desc()).all()


def get_inventory(db: Session, inventory_id: UUID) -> Inventory:
    inv = db.get(Inventory, inventory_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return inv


def create_inventory(db: Session, inventory_in: InventoryCreate) -> Inventory:
    now = datetime.utcnow()
    inv = Inventory(
        **inventory_in.model_dump(),
        created_at=now,
        updated_at=now,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


def update_inventory(
    db: Session, inventory_id: UUID, inventory_in: InventoryUpdate
) -> Inventory:
    inv = get_inventory(db, inventory_id)
    data = inventory_in.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(inv, k, v)
    inv.updated_at = datetime.utcnow()
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


def delete_inventory(db: Session, inventory_id: UUID) -> None:
    inv = get_inventory(db, inventory_id)
    db.delete(inv)
    db.commit()
