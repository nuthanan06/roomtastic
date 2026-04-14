"""Legacy image / depth / scraping routes (MiDaS, Tripo, IKEA, etc.)."""
import base64
import json
import os
import shutil
import subprocess
import sys
import time
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from api.process.process import process_url as process_url_handler

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
            original_b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
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
                resp["backImage"] = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
            with open(back_depth, "rb") as f:
                resp["backDepthMap"] = "data:image/png;base64," + base64.b64encode(f.read()).decode()

    try:
        os.remove(input_path)
        os.remove(depth_path)
    except OSError:
        pass

    return JSONResponse(resp)


@router.post("/process-3d")
async def process_3d(image: UploadFile = File(...)):
    tmp_dir = os.path.join(os.getcwd(), "temp", f"run_{int(time.time() * 1000)}")
    os.makedirs(tmp_dir, exist_ok=True)
    input_path = _save_upload(tmp_dir, image, "input.jpg")

    gemini_cmd = [sys.executable, "gemini_orthographic_genai.py", input_path, tmp_dir]
    proc = subprocess.run(gemini_cmd, cwd=BACKEND_ROOT, capture_output=True)
    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail={"error": "Gemini failed", "output": proc.stderr.decode()},
        )

    views = ["front", "back", "left", "right", "top", "bottom"]
    views_b64 = {}
    depths_b64 = {}
    for v in views:
        img_p = os.path.join(tmp_dir, f"{v}.png")
        depth_p = os.path.join(tmp_dir, f"{v}_depth.png")
        subprocess.run(
            [sys.executable, "depth_estimator.py", img_p, depth_p],
            cwd=BACKEND_ROOT,
            capture_output=True,
        )
        if os.path.exists(img_p):
            with open(img_p, "rb") as f:
                views_b64[v] = "data:image/png;base64," + base64.b64encode(f.read()).decode()
        if os.path.exists(depth_p):
            with open(depth_p, "rb") as f:
                depths_b64[v] = "data:image/png;base64," + base64.b64encode(f.read()).decode()

    merged_ply = os.path.join(tmp_dir, "merged.ply")
    subprocess.run(
        [sys.executable, "merge_point_clouds.py", tmp_dir, merged_ply],
        cwd=BACKEND_ROOT,
    )
    merged_b64 = None
    if os.path.exists(merged_ply):
        with open(merged_ply, "rb") as f:
            merged_b64 = "data:application/octet-stream;base64," + base64.b64encode(f.read()).decode()

    resp = {"views": views_b64, "depths": depths_b64, "mergedPly": merged_b64, "success": True}
    return JSONResponse(resp)


@router.post("/tripo")
async def tripo_endpoint(image: UploadFile = File(...), prompt: Optional[str] = Form(None)):
    tmp_dir = os.path.join(os.getcwd(), "temp", f"tripo_{int(time.time() * 1000)}")
    os.makedirs(tmp_dir, exist_ok=True)
    input_path = _save_upload(tmp_dir, image, "input.jpg")

    args = [sys.executable, "tripo_generate.py", input_path, tmp_dir]
    if prompt:
        args += ["--prompt", prompt]
    proc = subprocess.run(args, cwd=BACKEND_ROOT, capture_output=True)
    out = proc.stdout.decode() + proc.stderr.decode()

    first = out.find("{")
    last = out.rfind("}")
    if first == -1 or last == -1 or last <= first:
        raise HTTPException(
            status_code=500,
            detail={"error": "No JSON output from tripo script", "output": out},
        )
    part = out[first : last + 1]
    try:
        pyresp = json.loads(part)
    except Exception:
        raise HTTPException(status_code=500, detail={"error": "Invalid JSON from tripo", "output": part})

    if pyresp.get("error"):
        raise HTTPException(status_code=500, detail=pyresp.get("error"))

    models = {}
    filesObj = pyresp.get("files", {})
    for k, v in filesObj.items():
        if isinstance(v, str) and os.path.exists(v):
            ext = os.path.splitext(v)[1].lower()
            mime = "application/octet-stream"
            if ext == ".glb":
                mime = "model/gltf-binary"
            with open(v, "rb") as f:
                models[k] = f"data:{mime};base64," + base64.b64encode(f.read()).decode()

    return JSONResponse({"success": True, "models": models})


@router.post("/process-url")
async def process_url(req: dict):
    resp = process_url_handler(req)
    return JSONResponse(resp)


@router.post("/scrape-ikea")
async def scrape_ikea_product(req: dict):
    url = req.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    if "ikea.com" not in url.lower():
        raise HTTPException(status_code=400, detail="Only IKEA URLs are supported")

    headless = req.get("headless", True)

    try:
        from utils.ikea_scraper import scrape_ikea_product as scrape_fn

        product_data = scrape_fn(url, headless=headless)

        if "error" in product_data:
            raise HTTPException(status_code=500, detail=product_data["error"])

        return JSONResponse({"success": True, "product": product_data})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
