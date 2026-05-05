"""Backfill inventory.thumbnail_url for Hunyuan-generated rows from job payloads.

Usage:
  cd backend
  ./venv/bin/python scripts/backfill_inventory_thumbnails_from_jobs.py
"""

from __future__ import annotations

import base64
import os
from pathlib import Path
import sys
from uuid import UUID

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.db.session import session_scope
from app.models.inventory import Inventory
from app.models.job import Job, JobStatus


PUBLIC_BACKEND_URL = os.environ.get("PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
OUT_DIR = Path(__file__).resolve().parents[1] / "glb_models"


def _valid_uuid(raw: object) -> UUID | None:
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


def _decode_base64_bytes(raw: str) -> bytes | None:
    cleaned = (raw or "").strip()
    if not cleaned:
        return None
    if cleaned.startswith("data:") and "," in cleaned:
        cleaned = cleaned.split(",", 1)[1]
    cleaned = "".join(cleaned.split())
    try:
        return base64.b64decode(cleaned)
    except Exception:
        return None


def _image_ext_from_mime(mime: str | None) -> str | None:
    m = (mime or "").strip().lower()
    if m == "image/png":
        return "png"
    if m in {"image/jpeg", "image/jpg"}:
        return "jpg"
    if m == "image/webp":
        return "webp"
    if m == "image/gif":
        return "gif"
    return None


def _image_ext_from_bytes(raw: bytes) -> str:
    if len(raw) >= 8 and raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(raw) >= 3 and raw[:3] == b"\xff\xd8\xff":
        return "jpg"
    if len(raw) >= 6 and raw[:6] in {b"GIF87a", b"GIF89a"}:
        return "gif"
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "webp"
    return "png"


def _write_thumb_file(inventory_id: UUID, data: bytes, ext: str) -> str:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"hunyuan_{inventory_id}_thumb.{ext}"
    path = OUT_DIR / filename
    path.write_bytes(data)
    return f"{PUBLIC_BACKEND_URL}/glb-models/{filename}"


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

        payload_by_inventory: dict[UUID, dict] = {}
        for job in jobs:
            result = job.result or {}
            inv_id = _valid_uuid(result.get("inventory_id"))
            if not inv_id:
                continue
            payload_by_inventory[inv_id] = job.payload or {}

        candidates = (
            s.query(Inventory)
            .filter(
                Inventory.source == "hunyuan.runpod",
                Inventory.thumbnail_url.is_(None),
            )
            .all()
        )

        updated = 0
        for inv in candidates:
            payload = payload_by_inventory.get(inv.inventory_id, {})
            if not payload:
                continue

            image_url = str(payload.get("image_url") or "").strip()
            if image_url:
                inv.thumbnail_url = image_url
                updated += 1
                continue

            raw = _decode_base64_bytes(str(payload.get("image_base64") or ""))
            if not raw:
                continue
            ext = _image_ext_from_mime(str(payload.get("image_mime") or "")) or _image_ext_from_bytes(raw)
            inv.thumbnail_url = _write_thumb_file(inv.inventory_id, raw, ext)
            updated += 1

        print(f"Found {len(candidates)} inventory rows missing thumbnails.")
        print(f"Backfilled {updated} thumbnails.")


if __name__ == "__main__":
    main()
