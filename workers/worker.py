from __future__ import annotations

import json
import os
import sys
import time
import uuid
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND = os.environ.get("BACKEND_PATH", os.path.join(ROOT, "backend"))
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from sqlalchemy import select

from app.models.furniture import Furniture
from app.models.inventory import Inventory
from app.models.job import Job, JobStatus
from app.models.room import Room
from app.db.session import session_scope
from app.db.init_db import init_db

POLL_INTERVAL_SECONDS = float(os.environ.get("WORKER_POLL_INTERVAL", "1.0"))


def _now() -> datetime:
    return datetime.utcnow()


def _room_uuid(room_id) -> uuid.UUID | None:
    if room_id is None:
        return None
    if isinstance(room_id, uuid.UUID):
        return room_id
    try:
        return uuid.UUID(str(room_id))
    except (ValueError, TypeError):
        return None


def _claim_next_job():
    with session_scope() as s:
        j = (
            s.execute(
                select(Job)
                .where(Job.status == JobStatus.pending)
                .order_by(Job.created_at.asc())
                .limit(1)
            )
            .scalars()
            .first()
        )
        if not j:
            return None
        j.status = JobStatus.running
        j.started_at = _now()
        j.updated_at = _now()
        j.attempts = int(j.attempts or 0) + 1
        s.add(j)
        s.commit()
        s.refresh(j)
        return j.job_id


def _finish_job(job_id, *, status: JobStatus, result=None, error: str | None = None):
    with session_scope() as s:
        j = s.get(Job, job_id)
        if not j:
            return
        j.status = status
        j.result = result
        j.error = error
        j.finished_at = _now()
        j.updated_at = _now()
        s.add(j)


def _handle_layout_generate(job_id, payload: dict):
    room_id = _room_uuid(payload.get("room_id"))
    if not room_id:
        raise RuntimeError("invalid room_id")

    with session_scope() as s:
        r = s.get(Room, room_id)
        if not r:
            raise RuntimeError("room not found")

        existing = (
            s.execute(select(Furniture).where(Furniture.room_id == room_id)).scalars().all()
        )
        if existing:
            return {"message": "Room already has furniture; no-op placeholder", "suggestions": []}

        inv = s.execute(select(Inventory).order_by(Inventory.updated_at.desc()).limit(3)).scalars().all()
        suggestions = []
        for idx, item in enumerate(inv):
            suggestions.append(
                {
                    "inventory_id": str(item.inventory_id),
                    "name": item.name,
                    "coordinates": {"x": idx * 1.5, "y": 0, "z": 0},
                    "rotation": 0,
                }
            )
        return {"message": "Generated placeholder layout", "suggestions": suggestions}


def _handle_layout_optimize(job_id, payload: dict):
    room_id = _room_uuid(payload.get("room_id"))
    if not room_id:
        raise RuntimeError("invalid room_id")

    with session_scope() as s:
        r = s.get(Room, room_id)
        if not r:
            raise RuntimeError("room not found")

        items = s.execute(select(Furniture).where(Furniture.room_id == room_id)).scalars().all()
        for idx, f in enumerate(items):
            try:
                coords = json.loads(f.coordinates or "{}")
            except (json.JSONDecodeError, TypeError):
                coords = {}
            if not isinstance(coords, dict):
                coords = {}
            coords["x"] = float(coords.get("x", 0)) + idx * 0.25
            f.coordinates = json.dumps(coords)
            f.updated_at = _now()
            s.add(f)
        r.last_edited = _now()
        s.add(r)
        return {"message": "Optimized placeholder layout", "moved": len(items)}


def _handle_furniture_suggestions(job_id, payload: dict):
    with session_scope() as s:
        inv = s.execute(select(Inventory).order_by(Inventory.updated_at.desc()).limit(10)).scalars().all()
        return {
            "message": "Placeholder suggestions",
            "items": [
                {
                    "inventory_id": str(i.inventory_id),
                    "name": i.name,
                    "category": i.category,
                    "price": i.price,
                    "thumbnail_url": i.thumbnail_url,
                    "url_link": i.url_link,
                }
                for i in inv
            ],
        }


def _handle_room_chat(job_id, payload: dict):
    room_id = _room_uuid(payload.get("room_id"))
    message = str(payload.get("message") or "")
    response = f"Placeholder assistant: I received '{message}'."

    lower = message.lower()
    colors = ["white", "black", "gray", "grey", "blue", "red", "green", "beige", "cream", "brown", "yellow"]
    chosen = None
    for c in colors:
        if c in lower and "wall" in lower:
            chosen = c
            break

    updated_room = False
    if chosen and room_id:
        with session_scope() as s:
            r = s.get(Room, room_id)
            if r:
                r.wall_colour = chosen
                r.last_edited = _now()
                s.add(r)
                updated_room = True
                response = f"Updated wall_colour to '{chosen}'."

    return {"message": response, "updated_room": updated_room}


HANDLERS = {
    "layout.generate": _handle_layout_generate,
    "layout.optimize": _handle_layout_optimize,
    "furniture.suggestions": _handle_furniture_suggestions,
    "room.chat": _handle_room_chat,
}


def run_forever():
    # Ensure all tables (including `jobs`) exist before polling. The backend also
    # runs create_all on startup, but the worker may start first in compose.
    init_db()
    print("Roomtastic worker started. Polling DB for jobs...")
    while True:
        job_id = _claim_next_job()
        if not job_id:
            time.sleep(POLL_INTERVAL_SECONDS)
            continue
        try:
            with session_scope() as s:
                j = s.get(Job, job_id)
                if not j:
                    continue
                handler = HANDLERS.get(j.type)
                if not handler:
                    raise RuntimeError(f"no handler for job type {j.type}")
                payload = j.payload or {}
            result = handler(job_id, payload)
            _finish_job(job_id, status=JobStatus.succeeded, result=result, error=None)
        except Exception as e:
            _finish_job(job_id, status=JobStatus.failed, result=None, error=str(e))


if __name__ == "__main__":
    run_forever()
