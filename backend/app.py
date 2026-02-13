from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
import shutil
import subprocess
import base64
import json
import time
from typing import Optional

# ensure backend package imports work
ROOT = os.path.abspath(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

try:
    from utils.database import Database
except Exception:
    # fallback if running from repo root
    sys.path.insert(0, os.path.abspath(os.path.join(ROOT, "..")))
    from utils.database import Database

try:
    from utils.meshy import MeshyHelper
except Exception:
    sys.path.insert(0, os.path.join(os.path.abspath(os.path.join(ROOT, "..")), "backend", "meshy"))
    from meshy import MeshyHelper

app = FastAPI()

# Allow CORS for development; adjust `allow_origins` for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def save_upload(tmp_dir: str, upload: UploadFile, filename: str) -> str:
    path = os.path.join(tmp_dir, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(upload.file, f)
    return path


@app.get("/api/hello")
def hello():
    return "Hello from Python backend!"


@app.post("/api/process-image")
async def process_image(image: UploadFile = File(...), backImage: Optional[UploadFile] = File(None), width: Optional[float] = Form(None), depth: Optional[float] = Form(None), height: Optional[float] = Form(None)):
    tmp_dir = os.path.join(os.getcwd(), "temp")
    os.makedirs(tmp_dir, exist_ok=True)
    input_path = save_upload(tmp_dir, image, "input.jpg")

    depth_path = os.path.join(tmp_dir, "depth.png")
    cmd = [sys.executable, "depth_estimator.py", input_path, depth_path]
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True)
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail={"error": "MiDaS failed", "output": proc.stderr.decode()})

    try:
        with open(input_path, "rb") as f:
            original_b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
        with open(depth_path, "rb") as f:
            depth_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    resp = {"originalImage": original_b64, "depthMap": depth_b64, "width": width or 0, "depth": depth or 0, "height": height or 0, "success": True}

    # optional back image
    if backImage:
        back_path = save_upload(tmp_dir, backImage, "back_input.jpg")
        back_depth = os.path.join(tmp_dir, "back_depth.png")
        proc2 = subprocess.run([sys.executable, "depth_estimator.py", back_path, back_depth], cwd=ROOT, capture_output=True)
        if proc2.returncode == 0:
            with open(back_path, "rb") as f:
                resp["backImage"] = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
            with open(back_depth, "rb") as f:
                resp["backDepthMap"] = "data:image/png;base64," + base64.b64encode(f.read()).decode()

    # cleanup
    try:
        os.remove(input_path)
        os.remove(depth_path)
    except Exception:
        pass

    return JSONResponse(resp)


@app.post("/api/process-3d")
async def process_3d(image: UploadFile = File(...)):
    tmp_dir = os.path.join(os.getcwd(), "temp", f"run_{int(time.time()*1000)}")
    os.makedirs(tmp_dir, exist_ok=True)
    input_path = save_upload(tmp_dir, image, "input.jpg")

    # generate six views
    gemini_cmd = [sys.executable, "gemini_orthographic_genai.py", input_path, tmp_dir]
    proc = subprocess.run(gemini_cmd, cwd=ROOT, capture_output=True)
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail={"error": "Gemini failed", "output": proc.stderr.decode()})

    views = ["front", "back", "left", "right", "top", "bottom"]
    views_b64 = {}
    depths_b64 = {}
    for v in views:
        img_p = os.path.join(tmp_dir, f"{v}.png")
        depth_p = os.path.join(tmp_dir, f"{v}_depth.png")
        proc = subprocess.run([sys.executable, "depth_estimator.py", img_p, depth_p], cwd=ROOT, capture_output=True)
        if os.path.exists(img_p):
            with open(img_p, "rb") as f:
                views_b64[v] = "data:image/png;base64," + base64.b64encode(f.read()).decode()
        if os.path.exists(depth_p):
            with open(depth_p, "rb") as f:
                depths_b64[v] = "data:image/png;base64," + base64.b64encode(f.read()).decode()

    merged_ply = os.path.join(tmp_dir, "merged.ply")
    subprocess.run([sys.executable, "merge_point_clouds.py", tmp_dir, merged_ply], cwd=ROOT)
    merged_b64 = None
    if os.path.exists(merged_ply):
        with open(merged_ply, "rb") as f:
            merged_b64 = "data:application/octet-stream;base64," + base64.b64encode(f.read()).decode()

    resp = {"views": views_b64, "depths": depths_b64, "mergedPly": merged_b64, "success": True}
    return JSONResponse(resp)


@app.post("/api/tripo")
async def tripo_endpoint(image: UploadFile = File(...), prompt: Optional[str] = Form(None)):
    tmp_dir = os.path.join(os.getcwd(), "temp", f"tripo_{int(time.time()*1000)}")
    os.makedirs(tmp_dir, exist_ok=True)
    input_path = save_upload(tmp_dir, image, "input.jpg")

    args = [sys.executable, "tripo_generate.py", input_path, tmp_dir]
    if prompt:
        args += ["--prompt", prompt]
    proc = subprocess.run(args, cwd=ROOT, capture_output=True)
    out = proc.stdout.decode() + proc.stderr.decode()

    # extract JSON object from output
    first = out.find('{')
    last = out.rfind('}')
    if first == -1 or last == -1 or last <= first:
        raise HTTPException(status_code=500, detail={"error": "No JSON output from tripo script", "output": out})
    part = out[first:last+1]
    try:
        pyresp = json.loads(part)
    except Exception:
        raise HTTPException(status_code=500, detail={"error": "Invalid JSON from tripo", "output": part})

    if pyresp.get('error'):
        raise HTTPException(status_code=500, detail=pyresp.get('error'))

    models = {}
    filesObj = pyresp.get('files', {})
    for k, v in filesObj.items():
        if isinstance(v, str) and os.path.exists(v):
            ext = os.path.splitext(v)[1].lower()
            mime = "application/octet-stream"
            if ext == '.glb':
                mime = 'model/gltf-binary'
            with open(v, 'rb') as f:
                models[k] = f"data:{mime};base64," + base64.b64encode(f.read()).decode()

    return JSONResponse({"success": True, "models": models})


@app.post("/api/process-url")
async def process_url(req: dict):
    url = req.get('url')
    if not url:
        raise HTTPException(status_code=400, detail='url is required')

    tmp_dir = os.path.join(os.getcwd(), 'temp')
    os.makedirs(tmp_dir, exist_ok=True)
    # accept data: URIs or remote URLs
    if url.startswith('data:'):
        comma = url.find(',')
        if comma < 0:
            raise HTTPException(status_code=400, detail='invalid data URI')
        meta = url[5:comma]
        data = url[comma+1:]
        if ';base64' in meta:
            file_bytes = base64.b64decode(data)
        else:
            file_bytes = data.encode()
        original_path = os.path.join(tmp_dir, f"input_{int(time.time()*1000)}.jpg")
        with open(original_path, 'wb') as f:
            f.write(file_bytes)
    else:
        # remote URL
        import requests
        r = requests.get(url)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail=f'Failed to fetch URL: HTTP {r.status_code}')
        original_path = os.path.join(tmp_dir, f"input_{int(time.time()*1000)}_{os.path.basename(url)}")
        with open(original_path, 'wb') as f:
            f.write(r.content)

    # Use Database and MeshyHelper directly
    try:
        db = Database()
        image_url = db.upload_image_and_get_link(original_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'upload error: {e}')

    try:
        mh = MeshyHelper(name=os.path.basename(original_path), description='created from URL', image_url=image_url)
        task_id = mh.create_image_to_3d(image_url, should_texture=True, enable_pbr=True, should_remesh=True, save_pre_remeshed_model=True)
        glb = mh.get_glb_link(task_id, wait=True, timeout=900, poll_interval=5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Meshy error: {e}')

    return JSONResponse({"success": True, "task_id": task_id, "glb_url": glb})
