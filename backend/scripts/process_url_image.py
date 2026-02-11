#!/usr/bin/env python3
"""Orchestration script to upload an image and create/poll a Meshy Image->3D task

Usage: python3 backend/scripts/process_url_image.py /absolute/path/to/image.jpg
Outputs JSON to stdout: {"success": true, "task_id": "...", "glb_url": "..."}
"""
import os
import sys
import json
import time

# Make sure project root is on sys.path so we can import local modules
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


from backend.db.database import Database

# Import Meshy helper robustly: try absolute import first, then fall back to inserting paths
try:
    from backend.meshy.helper import MeshyHelper
except Exception as e:
    print("Warning: failed to import backend.meshy.helper via package import:", e)
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    # ensure repo root is on sys.path
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)
    try:
        from backend.meshy.helper import MeshyHelper
    except Exception:
        # as a last resort, import helper.py directly from backend/meshy
        meshy_dir = os.path.join(repo_root, "backend", "meshy")
        if meshy_dir not in sys.path:
            sys.path.insert(0, meshy_dir)
        from helper import Meshy


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "missing file path argument"}))
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({"success": False, "error": f"file not found: {file_path}"}))
        sys.exit(1)

    try:
        db = Database()
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Database init error: {e}"}))
        sys.exit(1)

    try:
        image_url = db.upload_image_and_get_link(file_path)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"upload error: {e}"}))
        sys.exit(1)

    if not image_url:
        print(json.dumps({"success": False, "error": "upload returned empty URL"}))
        sys.exit(1)

    # Create a Meshy task
    try:
        # Provide a basic name and description; callers may extend later
        name = os.path.basename(file_path)
        mh = MeshyHelper(name=name, description=f"Created from {name}", image_url=image_url)
        task_id = mh.create_image_to_3d(image_url,
                                       should_texture=True,
                                       enable_pbr=True,
                                       should_remesh=True,
                                       save_pre_remeshed_model=True)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Meshy create error: {e}"}))
        sys.exit(1)

    # Poll for GLB
    try:
        glb = mh.get_glb_link(task_id, wait=True, timeout=900, poll_interval=5)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Meshy poll error: {e}", "task_id": task_id}))
        sys.exit(1)

    if not glb:
        print(json.dumps({"success": False, "error": "No GLB URL returned", "task_id": task_id}))
        sys.exit(1)

    print(json.dumps({"success": True, "task_id": task_id, "glb_url": glb}))


if __name__ == "__main__":
    main()
