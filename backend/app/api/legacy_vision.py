"""Legacy image / depth / scraping routes (MiDaS, Tripo, IKEA, etc.)."""

import base64
import os
import shutil
import subprocess
import sys
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.api.process import process_url as process_url_handler

BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

router = APIRouter(tags=["legacy-vision"])


def _save_upload(tmp_dir: str, upload: UploadFile, filename: str) -> str:
    path = os.path.join(tmp_dir, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(upload.file, f)
    return path


@router.get("/hello")
def hello():
    return "Hello from Python backend!"


@router.post("/process-image")
async def process_image(
    image: UploadFile = File(...),
    backImage: Optional[UploadFile] = File(None),
    width: Optional[float] = Form(None),
    depth: Optional[float] = Form(None),
    height: Optional[float] = Form(None),
):
    tmp_dir = os.path.join(os.getcwd(), "temp")
    os.makedirs(tmp_dir, exist_ok=True)
    input_path = _save_upload(tmp_dir, image, "input.jpg")

    depth_path = os.path.join(tmp_dir, "depth.png")
    cmd = [sys.executable, "depth_estimator.py", input_path, depth_path]
    proc = subprocess.run(cmd, cwd=BACKEND_ROOT, capture_output=True)
    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail={"error": "MiDaS failed", "output": proc.stderr.decode()},
        )

    try:
        with open(input_path, "rb") as f:
            original_b64 = (
                "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
            )
        with open(depth_path, "rb") as f:
            depth_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    resp = {
        "originalImage": original_b64,
        "depthMap": depth_b64,
        "width": width or 0,
        "depth": depth or 0,
        "height": height or 0,
        "success": True,
    }

    if backImage:
        back_path = _save_upload(tmp_dir, backImage, "back_input.jpg")
        back_depth = os.path.join(tmp_dir, "back_depth.png")
        proc2 = subprocess.run(
            [sys.executable, "depth_estimator.py", back_path, back_depth],
            cwd=BACKEND_ROOT,
            capture_output=True,
        )
        if proc2.returncode == 0:
            with open(back_path, "rb") as f:
                resp["backImage"] = (
                    "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
                )
            with open(back_depth, "rb") as f:
                resp["backDepthMap"] = (
                    "data:image/png;base64," + base64.b64encode(f.read()).decode()
                )

    try:
        os.remove(input_path)
        os.remove(depth_path)
    except OSError:
        pass

    return JSONResponse(resp)


@router.post("/process-url")
async def process_url(req: dict):
    resp = process_url_handler(req)
    return JSONResponse(resp)
