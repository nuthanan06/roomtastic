import os
import time
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.inventory import Inventory
from app.models.job import Job, JobStatus
from app.schemas.inventory import InventoryCreate, InventoryUpdate
from app.services.jobs import enqueue_job

HUNYUAN_SYNC_TIMEOUT_SECONDS = float(
    os.environ.get("HUNYUAN_SYNC_TIMEOUT_SECONDS", "900")
)
HUNYUAN_SYNC_POLL_SECONDS = float(os.environ.get("HUNYUAN_SYNC_POLL_SECONDS", "2"))


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


def list_inventory(db: Session) -> list:
    return db.query(Inventory).order_by(Inventory.updated_at.desc()).all()


def get_inventory(db: Session, inventory_id: UUID) -> Inventory:
    inv = db.get(Inventory, inventory_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return inv


def _wait_for_job_terminal_state(db: Session, job_id: UUID) -> Job | None:
    deadline = time.monotonic() + max(HUNYUAN_SYNC_TIMEOUT_SECONDS, 1.0)
    while time.monotonic() < deadline:
        db.expire_all()
        job = db.get(Job, job_id)
        if not job:
            return None
        if job.status in (JobStatus.succeeded, JobStatus.failed):
            return job
        time.sleep(max(HUNYUAN_SYNC_POLL_SECONDS, 0.1))
    db.expire_all()
    return db.get(Job, job_id)


def _create_inventory_from_hunyuan(db: Session, inventory_in: InventoryCreate) -> Inventory:
    opts = inventory_in.hunyuan
    if not opts:
        raise HTTPException(status_code=400, detail="hunyuan options are required")

    payload = {
        "inventory_name": (inventory_in.name or "").strip() or "Generated Item",
        "inventory_category": inventory_in.category,
        "inventory_description": inventory_in.description,
        "width": inventory_in.width,
        "length": inventory_in.length,
        "height": inventory_in.height,
        "tags": _normalize_tags(inventory_in.tags),
        "image_base64": opts.image_base64,
        "image_url": opts.image_url,
        "quality": opts.quality,
        "include_texture": opts.include_texture,
        "num_inference_steps": opts.num_inference_steps,
        "octree_resolution": opts.octree_resolution,
        "seed": opts.seed,
        "guidance_scale": opts.guidance_scale,
        "num_chunks": opts.num_chunks,
        "face_count": opts.face_count,
    }
    job = enqueue_job(db, "hunyuan.generate", payload)
    finished = _wait_for_job_terminal_state(db, job.job_id)

    if not finished or finished.status not in (JobStatus.succeeded, JobStatus.failed):
        raise HTTPException(
            status_code=504,
            detail={
                "message": "Hunyuan generation is still running",
                "job_id": str(job.job_id),
            },
        )
    if finished.status == JobStatus.failed:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Hunyuan generation failed",
                "job_id": str(job.job_id),
                "error": finished.error,
            },
        )

    result = finished.result or {}
    inventory_id_raw = result.get("inventory_id")
    if not inventory_id_raw:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Hunyuan job finished without inventory_id",
                "job_id": str(job.job_id),
            },
        )
    try:
        inventory_id = UUID(str(inventory_id_raw))
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Invalid inventory_id returned by Hunyuan job",
                "job_id": str(job.job_id),
                "inventory_id": str(inventory_id_raw),
            },
        ) from exc

    inv = db.get(Inventory, inventory_id)
    if not inv:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Inventory record missing after Hunyuan generation",
                "job_id": str(job.job_id),
                "inventory_id": str(inventory_id),
            },
        )
    return inv


def create_inventory(db: Session, inventory_in: InventoryCreate) -> Inventory:
    if inventory_in.hunyuan:
        return _create_inventory_from_hunyuan(db, inventory_in)
    if not inventory_in.name or not inventory_in.name.strip():
        raise HTTPException(status_code=400, detail="name is required")

    now = datetime.utcnow()
    payload = inventory_in.model_dump(exclude={"hunyuan"})
    payload["name"] = inventory_in.name.strip()
    payload["tags"] = _normalize_tags(payload.get("tags"))
    inv = Inventory(
        **payload,
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
    if "tags" in data:
        data["tags"] = _normalize_tags(data.get("tags"))
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
