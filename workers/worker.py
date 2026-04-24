from __future__ import annotations

import base64
import json
import os
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib import error, request
from uuid import UUID

def _resolve_path(raw: str | None, *, base: Path, default: Path) -> str:
    candidate = Path(raw).expanduser() if raw else default
    if not candidate.is_absolute():
        candidate = (base / candidate).resolve()
    return str(candidate)


WORKERS_DIR = Path(__file__).resolve().parent
ROOT = WORKERS_DIR.parent
BACKEND = _resolve_path(
    os.environ.get("BACKEND_PATH"), base=WORKERS_DIR, default=ROOT / "backend"
)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from sqlalchemy import select

from app.db.init_db import init_db
from app.db.session import session_scope
from app.models.furniture import Furniture
from app.models.inventory import Inventory
from app.models.job import Job, JobStatus
from app.models.room import Room

POLL_INTERVAL_SECONDS = float(os.environ.get("WORKER_POLL_INTERVAL", "1.0"))
RUNPOD_API_BASE = os.environ.get("RUNPOD_API_BASE", "https://api.runpod.ai").rstrip("/")
RUNPOD_STATUS_POLL_SECONDS = float(os.environ.get("RUNPOD_STATUS_POLL_SECONDS", "10"))
RUNPOD_MAX_WAIT_SECONDS = float(os.environ.get("RUNPOD_MAX_WAIT_SECONDS", "1800"))
RUNPOD_HTTP_TIMEOUT_SECONDS = float(os.environ.get("RUNPOD_HTTP_TIMEOUT_SECONDS", "120"))
HUNYUAN_OUTPUT_DIR = _resolve_path(
    os.environ.get("HUNYUAN_OUTPUT_DIR"),
    base=ROOT,
    default=Path(BACKEND) / "glb_models",
)
PUBLIC_BACKEND_URL = os.environ.get("PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip(
    "/"
)


def _backfill_legacy_output_dir() -> None:
    target_dir = Path(HUNYUAN_OUTPUT_DIR)
    legacy_dir = WORKERS_DIR / "backend" / "glb_models"
    if not legacy_dir.exists():
        return
    if legacy_dir.resolve() == target_dir.resolve():
        return

    target_dir.mkdir(parents=True, exist_ok=True)
    for src in legacy_dir.glob("*.glb"):
        dst = target_dir / src.name
        if dst.exists():
            continue
        shutil.copy2(src, dst)


def _now() -> datetime:
    return datetime.utcnow()


def _claim_next_job():
    """Claim the next pending job using FOR UPDATE SKIP LOCKED for concurrency safety.

    FOR UPDATE SKIP LOCKED ensures only one worker claims each job, preventing race conditions.
    """
    with session_scope() as s:
        j = (
            s.execute(
                select(Job)
                .where(Job.status == JobStatus.pending)
                .order_by(Job.created_at.asc())
                .with_for_update(skip_locked=True)
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


def _as_int(raw, default: int) -> int:
    try:
        if raw is None:
            return default
        return int(raw)
    except (TypeError, ValueError):
        return default


def _as_float(raw, default: float) -> float:
    try:
        if raw is None:
            return default
        return float(raw)
    except (TypeError, ValueError):
        return default


def _as_bool(raw, default: bool) -> bool:
    if raw is None:
        return default
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    return bool(raw)


def _normalize_tags(raw) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    seen: set[str] = set()
    out: list[str] = []
    for tag in raw:
        t = str(tag or "").strip().lower()
        if not t or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def _runpod_json_request(
    *, method: str, url: str, api_key: str, payload: dict | None = None
) -> dict:
    headers = {"Authorization": f"Bearer {api_key}"}
    data: bytes | None = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    req = request.Request(url=url, method=method, data=data, headers=headers)
    try:
        with request.urlopen(req, timeout=max(RUNPOD_HTTP_TIMEOUT_SECONDS, 1.0)) as resp:
            raw = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"RunPod request failed ({exc.code}) for {url}: {detail[:500]}"
        ) from exc
    except error.URLError as exc:
        raise RuntimeError(f"RunPod request failed for {url}: {exc.reason}") from exc

    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"RunPod returned invalid JSON for {url}: {raw[:500]}") from exc


def _resolve_image_base64(payload: dict) -> str:
    image_base64 = str(payload.get("image_base64") or "").strip()
    if image_base64:
        return image_base64

    image_url = str(payload.get("image_url") or "").strip()
    if not image_url:
        raise RuntimeError("Either image_base64 or image_url is required")

    req = request.Request(
        image_url,
        headers={"User-Agent": "roomtastic-worker/1.0"},
        method="GET",
    )
    try:
        with request.urlopen(req, timeout=max(RUNPOD_HTTP_TIMEOUT_SECONDS, 1.0)) as resp:
            data = resp.read()
    except Exception as exc:
        raise RuntimeError(f"Failed to fetch image_url={image_url!r}: {exc}") from exc
    return base64.b64encode(data).decode("ascii")


def _build_run_input(payload: dict, image_base64: str) -> dict:
    run_input = {
        "image": image_base64,
        "num_inference_steps": _as_int(payload.get("num_inference_steps"), 50),
        "octree_resolution": _as_int(payload.get("octree_resolution"), 384),
        "texture": _as_bool(payload.get("include_texture"), True),
        "guidance_scale": _as_float(payload.get("guidance_scale"), 7.5),
        "num_chunks": _as_int(payload.get("num_chunks"), 200000),
        "face_count": _as_int(payload.get("face_count"), 80000),
    }
    quality = str(payload.get("quality") or "").strip()
    if quality:
        run_input["quality"] = quality
    seed = payload.get("seed")
    if seed is not None:
        run_input["seed"] = _as_int(seed, 1234)
    return run_input


def _poll_runpod_job(endpoint_id: str, api_key: str, runpod_job_id: str) -> dict:
    status_url = f"{RUNPOD_API_BASE}/v2/{endpoint_id}/status/{runpod_job_id}"
    deadline = time.monotonic() + max(RUNPOD_MAX_WAIT_SECONDS, 1.0)

    while True:
        response = _runpod_json_request(
            method="GET", url=status_url, api_key=api_key, payload=None
        )
        status = str(response.get("status") or "").upper()

        if status == "COMPLETED":
            return response
        if status in {"FAILED", "CANCELLED", "TIMED_OUT"}:
            details = response.get("error") or response.get("output") or response
            raise RuntimeError(
                f"RunPod job {runpod_job_id} ended with status={status}: {details}"
            )
        if time.monotonic() >= deadline:
            raise RuntimeError(
                f"RunPod job {runpod_job_id} timed out after {RUNPOD_MAX_WAIT_SECONDS} seconds"
            )

        time.sleep(max(RUNPOD_STATUS_POLL_SECONDS, 1.0))


def _extract_model_base64(data) -> str:
    if isinstance(data, dict):
        raw = data.get("model_base64")
        if isinstance(raw, str) and raw.strip():
            return raw
        for key in ("output", "result", "data"):
            nested = data.get(key)
            if nested is None:
                continue
            try:
                return _extract_model_base64(nested)
            except RuntimeError:
                pass

    if isinstance(data, list):
        for item in data:
            try:
                return _extract_model_base64(item)
            except RuntimeError:
                continue

    if isinstance(data, str) and data.strip():
        return data

    raise RuntimeError("RunPod output is missing model_base64")


def _decode_base64_bytes(raw: str) -> bytes:
    cleaned = raw.strip()
    if cleaned.startswith("data:") and "," in cleaned:
        cleaned = cleaned.split(",", 1)[1]
    cleaned = "".join(cleaned.split())
    try:
        return base64.b64decode(cleaned)
    except Exception as exc:
        raise RuntimeError("RunPod model_base64 output is not valid base64") from exc


def _write_glb_file(job_id, content: bytes) -> tuple[str, str]:
    out_dir = Path(HUNYUAN_OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"hunyuan_{job_id}.glb"
    file_path = out_dir / filename
    file_path.write_bytes(content)
    return filename, str(file_path)


def _public_model_url(filename: str) -> str:
    return f"{PUBLIC_BACKEND_URL}/glb-models/{filename}"


def _create_inventory_and_optional_furniture(
    payload: dict, *, model_url: str, runpod_job_id: str
) -> dict:
    name_of_furniture = str(payload.get("name_of_furniture") or "").strip()
    inventory_name = str(payload.get("inventory_name") or name_of_furniture).strip()
    if not inventory_name:
        inventory_name = "Generated Item"
    if not name_of_furniture:
        name_of_furniture = inventory_name
    inventory_category = str(payload.get("inventory_category") or "generated").strip()
    if not inventory_category:
        inventory_category = "generated"

    inventory_description = str(
        payload.get("inventory_description") or "Generated by Hunyuan-3D via RunPod"
    ).strip()
    coordinates = str(payload.get("coordinates") or '{"x":0,"y":0,"z":0}')
    rotation = _as_int(payload.get("rotation"), 0)
    width = _as_int(payload.get("width"), 0)
    height = _as_int(payload.get("height"), 0)
    length = _as_int(payload.get("length"), width)
    tags = _normalize_tags(payload.get("tags"))
    now = _now()

    with session_scope() as s:
        inventory = Inventory(
            name=inventory_name,
            category=inventory_category,
            width=width if width > 0 else None,
            length=length if length > 0 else None,
            height=height if height > 0 else None,
            model_url=model_url,
            description=inventory_description or None,
            source="hunyuan.runpod",
            source_id=str(runpod_job_id),
            tags=tags,
            created_at=now,
            updated_at=now,
        )
        s.add(inventory)
        s.flush()

        result: dict[str, str] = {"inventory_id": str(inventory.inventory_id)}
        room_id_raw = payload.get("room_id")
        if room_id_raw:
            try:
                room_id = UUID(str(room_id_raw))
            except ValueError as exc:
                raise RuntimeError(
                    f"Invalid room_id in hunyuan job payload: {room_id_raw!r}"
                ) from exc
            room = s.get(Room, room_id)
            if not room:
                raise RuntimeError(f"Room not found for generated furniture: {room_id}")

            furniture = Furniture(
                room_id=room_id,
                inventory_id=inventory.inventory_id,
                name_of_furniture=name_of_furniture,
                coordinates=coordinates,
                rotation=rotation,
                width=width,
                height=height,
                tags=tags,
                created_at=now,
                updated_at=now,
            )
            s.add(furniture)
            s.flush()
            result["furniture_id"] = str(furniture.furniture_id)
        return result


def _handle_hunyuan_generate(job_id, payload: dict):
    endpoint_id = str(os.environ.get("RUNPOD_ENDPOINT_ID") or "").strip()
    api_key = str(os.environ.get("RUNPOD_API_KEY") or "").strip()
    if not endpoint_id or not api_key:
        raise RuntimeError(
            "RUNPOD_ENDPOINT_ID and RUNPOD_API_KEY environment variables are required"
        )

    image_base64 = _resolve_image_base64(payload)
    run_input = _build_run_input(payload, image_base64)

    submit_url = f"{RUNPOD_API_BASE}/v2/{endpoint_id}/run"
    submit_response = _runpod_json_request(
        method="POST",
        url=submit_url,
        api_key=api_key,
        payload={"input": run_input},
    )
    runpod_job_id = str(submit_response.get("id") or "").strip()
    if not runpod_job_id:
        raise RuntimeError(f"RunPod submit response missing job id: {submit_response}")

    completed = _poll_runpod_job(endpoint_id, api_key, runpod_job_id)
    model_base64 = _extract_model_base64(completed.get("output"))
    model_bytes = _decode_base64_bytes(model_base64)

    filename, file_path = _write_glb_file(job_id, model_bytes)
    model_url = _public_model_url(filename)

    created_records = _create_inventory_and_optional_furniture(
        payload, model_url=model_url, runpod_job_id=runpod_job_id
    )
    return {
        "runpod_job_id": runpod_job_id,
        "runpod_status": str(completed.get("status") or "COMPLETED"),
        "model_url": model_url,
        "model_path": file_path,
        **created_records,
    }


HANDLERS = {
    "hunyuan.generate": _handle_hunyuan_generate,
}


def run_forever():
    # Ensure all tables (including `jobs`) exist before polling. The backend also
    # runs create_all on startup, but the worker may start first in compose.
    _backfill_legacy_output_dir()
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
