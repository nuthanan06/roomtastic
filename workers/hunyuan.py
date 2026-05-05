"""
Hunyuan 3D generation handler for the job worker.

Public entry point
------------------
handle_hunyuan_generate(job_id, payload)
  Called by worker.py when it picks up a hunyuan.generate job.
  Submits an image to RunPod, polls until the GLB is ready, saves it to disk,
  and creates the Inventory (and optionally Furniture) DB record.

Internal flow
-------------
  image source → RunPod submit → poll status → decode GLB → write files → write DB
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib import error, request
from urllib.parse import urlparse
from uuid import UUID

_MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB cap on fetched images

# ── Path setup (same pattern as worker.py so this module is independently importable) ──

_WORKERS_DIR = Path(__file__).resolve().parent
_ROOT = _WORKERS_DIR.parent
_BACKEND = str((_ROOT / "backend").resolve())
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from sqlalchemy import select  # noqa: E402 — after sys.path setup

from app.db.session import session_scope  # noqa: E402
from app.models.furniture import Furniture  # noqa: E402
from app.models.inventory import Inventory  # noqa: E402
from app.models.room import Room  # noqa: E402

# ── Configuration (all read from environment) ────────────────────────────────

RUNPOD_API_BASE = os.environ.get("RUNPOD_API_BASE", "https://api.runpod.ai").rstrip("/")
RUNPOD_STATUS_POLL_SECONDS = float(os.environ.get("RUNPOD_STATUS_POLL_SECONDS", "10"))
RUNPOD_MAX_WAIT_SECONDS = float(os.environ.get("RUNPOD_MAX_WAIT_SECONDS", "1800"))
RUNPOD_HTTP_TIMEOUT_SECONDS = float(os.environ.get("RUNPOD_HTTP_TIMEOUT_SECONDS", "120"))
PUBLIC_BACKEND_URL = os.environ.get("PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")

# Resolved by worker.py on startup; read here as a fallback for standalone use.
_OUTPUT_DIR_ENV = os.environ.get("HUNYUAN_OUTPUT_DIR", "")
HUNYUAN_OUTPUT_DIR = str(
    Path(_OUTPUT_DIR_ENV).expanduser().resolve()
    if _OUTPUT_DIR_ENV
    else (_ROOT / "backend" / "glb_models").resolve()
)


# ── Public entry point ───────────────────────────────────────────────────────

def handle_hunyuan_generate(job_id, payload: dict) -> dict:
    """
    Main handler called by the worker for hunyuan.generate jobs.

    1. Submits the image to the RunPod Hunyuan-3D endpoint.
    2. Polls until the job completes and returns a base64-encoded GLB.
    3. Decodes and saves the GLB (and source image as thumbnail) to disk.
    4. Creates an Inventory record in the DB (and Furniture if room_id is in payload).
    Returns a result dict stored on the Job record.
    """
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
        method="POST", url=submit_url, api_key=api_key, payload={"input": run_input}
    )
    runpod_job_id = str(submit_response.get("id") or "").strip()
    if not runpod_job_id:
        raise RuntimeError(f"RunPod submit response missing job id: {submit_response}")

    completed = _poll_runpod_job(endpoint_id, api_key, runpod_job_id)
    model_bytes = _decode_base64_bytes(_extract_model_base64(completed.get("output")))

    filename, _ = _write_glb_file(job_id, model_bytes)
    model_url = _public_model_url(filename)
    thumbnail_url, _ = _resolve_thumbnail_url(payload, job_id=job_id, image_base64=image_base64)

    created = _create_inventory_and_optional_furniture(
        payload, model_url=model_url, thumbnail_url=thumbnail_url, runpod_job_id=runpod_job_id
    )
    return {
        "runpod_job_id": runpod_job_id,
        "runpod_status": str(completed.get("status") or "COMPLETED"),
        "model_url": model_url,
        "thumbnail_url": thumbnail_url,
        **created,
    }


# ── RunPod API ───────────────────────────────────────────────────────────────

def _runpod_json_request(
    *, method: str, url: str, api_key: str, payload: dict | None = None
) -> dict:
    """Makes an authenticated JSON request to the RunPod REST API."""
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


def _poll_runpod_job(endpoint_id: str, api_key: str, runpod_job_id: str) -> dict:
    """Polls the RunPod status endpoint until the job completes, fails, or times out."""
    status_url = f"{RUNPOD_API_BASE}/v2/{endpoint_id}/status/{runpod_job_id}"
    deadline = time.monotonic() + max(RUNPOD_MAX_WAIT_SECONDS, 1.0)

    while True:
        response = _runpod_json_request(method="GET", url=status_url, api_key=api_key)
        status = str(response.get("status") or "").upper()

        if status == "COMPLETED":
            return response
        if status in {"FAILED", "CANCELLED", "TIMED_OUT"}:
            details = response.get("error") or response.get("output") or response
            raise RuntimeError(f"RunPod job {runpod_job_id} ended with status={status}: {details}")
        if time.monotonic() >= deadline:
            raise RuntimeError(
                f"RunPod job {runpod_job_id} timed out after {RUNPOD_MAX_WAIT_SECONDS}s"
            )

        time.sleep(max(RUNPOD_STATUS_POLL_SECONDS, 1.0))


# ── Image helpers ────────────────────────────────────────────────────────────

def _resolve_image_base64(payload: dict) -> str:
    """Returns base64-encoded image data, fetching from image_url if base64 not provided."""
    image_base64 = str(payload.get("image_base64") or "").strip()
    if image_base64:
        return image_base64

    image_url = str(payload.get("image_url") or "").strip()
    if not image_url:
        raise RuntimeError("Either image_base64 or image_url is required")

    # Basic SSRF guard: only allow http/https URLs.
    parsed = urlparse(image_url)
    if parsed.scheme not in {"http", "https"}:
        raise RuntimeError(
            f"image_url must use http or https, got scheme: {parsed.scheme!r}"
        )

    req = request.Request(image_url, headers={"User-Agent": "roomtastic-worker/1.0"}, method="GET")
    try:
        with request.urlopen(req, timeout=max(RUNPOD_HTTP_TIMEOUT_SECONDS, 1.0)) as resp:
            data = resp.read(_MAX_IMAGE_BYTES)
    except Exception as exc:
        raise RuntimeError(f"Failed to fetch image_url={image_url!r}: {exc}") from exc
    return base64.b64encode(data).decode("ascii")


def _build_run_input(payload: dict, image_base64: str) -> dict:
    """Builds the RunPod input dict from the job payload, applying defaults."""
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


def _image_ext_from_mime(mime: str | None) -> str | None:
    """Maps a MIME type string to a file extension, returning None if unrecognised."""
    if not mime:
        return None
    m = mime.strip().lower()
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
    """Detects image format from magic bytes; defaults to png when unrecognised."""
    if len(raw) >= 8 and raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(raw) >= 3 and raw[:3] == b"\xff\xd8\xff":
        return "jpg"
    if len(raw) >= 6 and raw[:6] in {b"GIF87a", b"GIF89a"}:
        return "gif"
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "webp"
    return "png"


# ── Output parsing ───────────────────────────────────────────────────────────

def _extract_model_base64(data) -> str:
    """Recursively searches a RunPod output value for the model_base64 field."""
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
    """Decodes a base64 string (strips optional data-URI prefix) to raw bytes."""
    cleaned = raw.strip()
    if cleaned.startswith("data:") and "," in cleaned:
        cleaned = cleaned.split(",", 1)[1]
    cleaned = "".join(cleaned.split())
    try:
        return base64.b64decode(cleaned)
    except Exception as exc:
        raise RuntimeError("RunPod model_base64 output is not valid base64") from exc


# ── File I/O ─────────────────────────────────────────────────────────────────

def _write_glb_file(job_id, content: bytes) -> tuple[str, str]:
    """Writes GLB bytes to the output directory; returns (filename, absolute_path)."""
    out_dir = Path(HUNYUAN_OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"hunyuan_{job_id}.glb"
    file_path = out_dir / filename
    file_path.write_bytes(content)
    return filename, str(file_path)


def _write_thumbnail_file(job_id, content: bytes, *, ext: str) -> tuple[str, str]:
    """Writes a thumbnail image to the output directory; returns (filename, absolute_path)."""
    out_dir = Path(HUNYUAN_OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"hunyuan_{job_id}_thumb.{ext}"
    file_path = out_dir / filename
    file_path.write_bytes(content)
    return filename, str(file_path)


def _public_model_url(filename: str) -> str:
    """Builds the public-facing URL for a file served by the backend static mount."""
    return f"{PUBLIC_BACKEND_URL}/glb-models/{filename}"


def _resolve_thumbnail_url(
    payload: dict, *, job_id, image_base64: str
) -> tuple[str | None, str | None]:
    """
    Determines the thumbnail URL for a generated item.
    If image_url was provided in the payload, uses it directly.
    Otherwise saves the source image bytes to disk and returns a local URL.
    """
    image_url = str(payload.get("image_url") or "").strip()
    if image_url:
        return image_url, None

    if not image_base64:
        return None, None

    image_bytes = _decode_base64_bytes(image_base64)
    ext = _image_ext_from_mime(str(payload.get("image_mime") or "").strip()) or _image_ext_from_bytes(image_bytes)
    thumb_filename, thumb_path = _write_thumbnail_file(job_id, image_bytes, ext=ext)
    return _public_model_url(thumb_filename), thumb_path


# ── Database ─────────────────────────────────────────────────────────────────

def _create_inventory_and_optional_furniture(
    payload: dict, *, model_url: str, thumbnail_url: str | None, runpod_job_id: str
) -> dict:
    """
    Creates an Inventory row for the generated model.
    If room_id is present in the payload, also creates a Furniture row in that room.
    Returns a dict with inventory_id and optionally furniture_id.
    """
    inventory_name = str(payload.get("inventory_name") or payload.get("name_of_furniture") or "").strip() or "Generated Item"
    inventory_category = str(payload.get("inventory_category") or "generated").strip() or "generated"
    inventory_description = str(payload.get("inventory_description") or "Generated by Hunyuan-3D via RunPod").strip()
    coordinates = str(payload.get("coordinates") or '{"x":0,"y":0,"z":0}')
    tags = _normalize_tags(payload.get("tags"))
    now = datetime.utcnow()

    user_id_raw = str(payload.get("user_id") or payload.get("userId") or "").strip()
    try:
        user_uuid = UUID(user_id_raw) if user_id_raw else None
    except ValueError:
        user_uuid = None

    with session_scope() as s:
        inventory = Inventory(
            name=inventory_name,
            category=inventory_category,
            width=_as_int(payload.get("width"), 0) or None,
            length=_as_int(payload.get("length"), _as_int(payload.get("width"), 0)) or None,
            height=_as_int(payload.get("height"), 0) or None,
            model_url=model_url,
            thumbnail_url=thumbnail_url,
            description=inventory_description or None,
            source="hunyuan.runpod",
            source_id=str(runpod_job_id),
            tags=tags,
            user_id=user_uuid,
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
                raise RuntimeError(f"Invalid room_id in hunyuan job payload: {room_id_raw!r}") from exc
            room = s.get(Room, room_id)
            if not room:
                raise RuntimeError(f"Room not found for generated furniture: {room_id}")
            furniture = Furniture(
                room_id=room_id,
                inventory_id=inventory.inventory_id,
                name_of_furniture=inventory_name,
                coordinates=coordinates,
                rotation=_as_int(payload.get("rotation"), 0),
                width=_as_int(payload.get("width"), 0),
                height=_as_int(payload.get("height"), 0),
                tags=tags,
                created_at=now,
                updated_at=now,
            )
            s.add(furniture)
            s.flush()
            result["furniture_id"] = str(furniture.furniture_id)

        return result


# ── Type coercion utilities ──────────────────────────────────────────────────

def _as_int(raw, default: int) -> int:
    """Safely casts a value to int, returning default on failure."""
    try:
        return default if raw is None else int(raw)
    except (TypeError, ValueError):
        return default


def _as_float(raw, default: float) -> float:
    """Safely casts a value to float, returning default on failure."""
    try:
        return default if raw is None else float(raw)
    except (TypeError, ValueError):
        return default


def _as_bool(raw, default: bool) -> bool:
    """Safely casts a value to bool; accepts 'true'/'1'/'yes'/'on' strings."""
    if raw is None:
        return default
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    return bool(raw)


def _normalize_tags(raw) -> list[str]:
    """Deduplicates and lowercases a list of tag strings."""
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
