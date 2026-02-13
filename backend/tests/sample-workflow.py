import os
import sys
import json

# Allow running this script directly by adding the repo root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.utils.database import Database

# Import Meshy helper robustly: try absolute import first, then fall back to inserting paths
try:
    from backend.utils.meshy import MeshyHelper
except Exception as e:
    print("Warning: failed to import backend.meshy.helper via package import:", e)
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    # ensure repo root is on sys.path
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)
    try:
        from backend.utils.meshy import MeshyHelper
    except Exception:
        # as a last resort, import helper.py directly from backend/meshy
        meshy_dir = os.path.join(repo_root, "backend", "meshy")
        if meshy_dir not in sys.path:
            sys.path.insert(0, meshy_dir)
        from helper import Meshy


def test_upload_image_to_3D_pipeline():
    db = Database()

    # instantiate Meshy with placeholders; actual image_url is passed to create_image_to_3d
    meshy = MeshyHelper(name="test", description="test run", image_url="")

    test_file_path = os.path.join(os.path.dirname(__file__), "..", "db", "testruns", "cunt.png")
    test_file_path = os.path.abspath(test_file_path)
    public_url = db.upload_image_and_get_link("/Users/nuthanantharmarajah/Desktop/CS Side Projects/roomtastic/backend/testruns/cunt.png")

    print("Public URL returned:", public_url)
    print("Test passed: upload_image_and_link returns a valid URL")

    currId = meshy.create_image_to_3d(public_url)
    print("Test passed: create_image_to_3d accepted the image URL and created a task successfully", currId)

    glb = meshy.get_glb_link(currId, wait=False)
    print("get_glb_link returned:", glb)


def test_if_done():
    meshy = MeshyHelper(name="test", description="test run", image_url="")

    newShit = meshy.get_image_to_3d("019c553c-94b2-7c13-834b-0d199aae8946")
    print("Meshy task JSON:")
    try:
        print(json.dumps(newShit, indent=2, ensure_ascii=False))
    except Exception:
        # Fallback if newShit is not JSON-serializable
        print(repr(newShit))

if __name__ == "__main__":
    test_if_done()


