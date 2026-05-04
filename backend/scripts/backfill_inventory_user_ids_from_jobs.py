"""Backfill inventory.user_id for Hunyuan-generated rows using job payload metadata.

Usage:
  cd backend
  ./venv/bin/python scripts/backfill_inventory_user_ids_from_jobs.py
"""

from __future__ import annotations

from uuid import UUID
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.db.session import session_scope
from app.models.inventory import Inventory
from app.models.job import Job, JobStatus


def _valid_uuid(raw: object) -> UUID | None:
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


def main() -> None:
    with session_scope() as s:
        jobs = (
            s.query(Job)
            .filter(
                Job.type == "hunyuan.generate",
                Job.status == JobStatus.succeeded,
            )
            .all()
        )

        inventory_owner_by_id: dict[UUID, UUID] = {}
        for job in jobs:
            payload = job.payload or {}
            result = job.result or {}
            inv_id = _valid_uuid(result.get("inventory_id"))
            owner_id = _valid_uuid(payload.get("user_id") or payload.get("userId"))
            if inv_id and owner_id:
                inventory_owner_by_id[inv_id] = owner_id

        if not inventory_owner_by_id:
            print("No backfillable hunyuan job records found.")
            return

        candidates = (
            s.query(Inventory)
            .filter(
                Inventory.user_id.is_(None),
                Inventory.source == "hunyuan.runpod",
            )
            .all()
        )

        updated = 0
        for inv in candidates:
            owner_id = inventory_owner_by_id.get(inv.inventory_id)
            if not owner_id:
                continue
            inv.user_id = owner_id
            updated += 1

        print(f"Found {len(candidates)} candidate inventory rows.")
        print(f"Backfilled {updated} inventory rows with user_id.")


if __name__ == "__main__":
    main()
