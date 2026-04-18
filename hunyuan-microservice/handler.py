import os
import sys
import base64
import tempfile
import traceback
import numpy as np

# Set env before any imports
os.environ["LD_LIBRARY_PATH"] = "/usr/lib/x86_64-linux-gnu:" + os.environ.get(
    "LD_LIBRARY_PATH", ""
)
os.environ["HF_HOME"] = os.environ.get("HF_HOME", "/runpod-volume/cache")
os.environ["HUGGINGFACE_HUB_CACHE"] = os.environ.get(
    "HUGGINGFACE_HUB_CACHE", "/runpod-volume/cache/hy3dgen"
)
os.environ["HF_MODULES_CACHE"] = os.environ.get(
    "HF_MODULES_CACHE", "/workspace/Hunyuan3D-2/hy3dgen/texgen"
)

sys.path.insert(0, "/workspace/Hunyuan3D-2")

import runpod
import torch
import trimesh
from io import BytesIO
from PIL import Image

from hy3dgen.rembg import BackgroundRemover
from hy3dgen.shapegen import (
    Hunyuan3DDiTFlowMatchingPipeline,
    FloaterRemover,
    DegenerateFaceRemover,
    FaceReducer,
)
from hy3dgen.shapegen.pipelines import export_to_trimesh
from hy3dgen.texgen import Hunyuan3DPaintPipeline

MODEL_PATH = os.environ.get(
    "MODEL_PATH", "/runpod-volume/cache/hy3dgen/tencent/Hunyuan3D-2"
)
TEX_MODEL_PATH = os.environ.get(
    "TEX_MODEL_PATH", "/runpod-volume/cache/hy3dgen/tencent/Hunyuan3D-2"
)
SUBFOLDER = os.environ.get("SUBFOLDER", "hunyuan3d-dit-v2-0")

print("Loading models...", flush=True)

rembg = BackgroundRemover()

pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
    MODEL_PATH,
    subfolder=SUBFOLDER,
    use_safetensors=True,
    device="cuda",
)
pipeline.enable_flashvdm(mc_algo="mc")

pipeline_tex = Hunyuan3DPaintPipeline.from_pretrained(TEX_MODEL_PATH)

print("Models loaded.", flush=True)


@torch.inference_mode()
def generate(params: dict) -> dict:
    b64_image = params.get("image")
    if not b64_image:
        raise ValueError("No input image provided")

    image = Image.open(BytesIO(base64.b64decode(b64_image)))

    if image.mode == "RGB":
        image = rembg(image.convert("RGB"))
    elif image.mode == "RGBA":
        alpha = np.array(image)[:, :, 3]
        if alpha.min() == 255:
            image = rembg(image.convert("RGB"))

    seed = params.get("seed", 1234)
    generator = torch.Generator("cuda").manual_seed(seed)
    octree_resolution = params.get("octree_resolution", 256)
    num_inference_steps = params.get("num_inference_steps", 30)
    guidance_scale = params.get("guidance_scale", 7.5)
    num_chunks = params.get("num_chunks", 8000)
    do_texture = params.get("texture", True)
    face_count = params.get("face_count", 40000)

    print(
        f"Generating shape: steps={num_inference_steps} octree={octree_resolution} texture={do_texture}",
        flush=True,
    )

    outputs = pipeline(
        image=image,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        generator=generator,
        octree_resolution=octree_resolution,
        num_chunks=num_chunks,
        output_type="mesh",
    )

    mesh = export_to_trimesh(outputs)[0]
    print(f"Shape generated: {mesh.faces.shape[0]} faces", flush=True)

    if do_texture:
        print("Running FloaterRemover...", flush=True)
        mesh = FloaterRemover()(mesh)
        print("Running DegenerateFaceRemover...", flush=True)
        mesh = DegenerateFaceRemover()(mesh)
        print("Running FaceReducer...", flush=True)
        mesh = FaceReducer()(mesh, max_facenum=face_count)
        print("Running texture pipeline...", flush=True)
        mesh = pipeline_tex(mesh, image)
        print("Texture done.", flush=True)

    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as f:
        mesh.export(f.name)
        glb_bytes = open(f.name, "rb").read()
        os.unlink(f.name)

    torch.cuda.empty_cache()
    return {"model_base64": base64.b64encode(glb_bytes).decode()}


def handler(job):
    try:
        params = job.get("input", {})
        return generate(params)
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e), "traceback": traceback.format_exc()}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
