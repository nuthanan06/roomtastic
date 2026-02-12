
import os
import time
import requests
import subprocess
import json
import base64
from fastapi import HTTPException
from utils.meshy import MeshyHelper
from utils.database import Database

def process_url(req: dict):
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
