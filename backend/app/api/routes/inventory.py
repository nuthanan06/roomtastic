from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.inventory import InventoryCreate, InventoryUpdate, InventoryOut
from app.controllers import inventory_controller as ctrl

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryOut])
def list_inventory(db: Session = Depends(get_db)):
    rows = ctrl.list_inventory(db)
    return [InventoryOut.model_validate(x) for x in rows]


@router.get("/{inventory_id}", response_model=InventoryOut)
def read_inventory(inventory_id: UUID, db: Session = Depends(get_db)):
    inv = ctrl.get_inventory(db, inventory_id)
    return InventoryOut.model_validate(inv)


@router.post("", response_model=InventoryOut)
def create_inventory(body: InventoryCreate, db: Session = Depends(get_db)):
    inv = ctrl.create_inventory(db, body)
    return InventoryOut.model_validate(inv)


@router.patch("/{inventory_id}", response_model=InventoryOut)
def patch_inventory(inventory_id: UUID, body: InventoryUpdate, db: Session = Depends(get_db)):
    inv = ctrl.update_inventory(db, inventory_id, body)
    return InventoryOut.model_validate(inv)


@router.delete("/{inventory_id}")
def remove_inventory(inventory_id: UUID, db: Session = Depends(get_db)):
    ctrl.delete_inventory(db, inventory_id)
    return {"ok": True}
