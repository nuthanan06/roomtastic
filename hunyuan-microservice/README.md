# Hunyuan3D-2 RunPod Serverless Worker

A serverless GPU worker that converts a single product image into a textured 3D GLB model using [Hunyuan3D-2](https://github.com/Tencent/Hunyuan3D-2) by Tencent.

---

## Overview

This worker runs on RunPod serverless and exposes an API that accepts a base64-encoded image and returns a base64-encoded GLB file. It handles the full pipeline:

1. Background removal (rembg)
2. 3D shape generation (Hunyuan3D-2 DiT)
3. Mesh post-processing (FloaterRemover, DegenerateFaceRemover, FaceReducer)
4. Texture generation (Hunyuan3D-2 Paint)

---

## Docker Image

```
nuthanan06/hunyuan3d-2:v1.4
```

Built with:
- Ubuntu 24.04
- Python 3.12
- PyTorch 2.8.0 + CUDA 12.8
- diffusers==0.29.0
- transformers==4.38.2

---

## Infrastructure

| Component | Details |
|---|---|
| GPU | RTX 4090 24GB PRO (recommended) |
| Container disk | 20 GB |
| Network volume | Required (mounted at `/runpod-volume`) |
| Model weights | `/runpod-volume/cache/hy3dgen/tencent/Hunyuan3D-2` |

### Environment Variables

| Variable | Value |
|---|---|
| `HF_HOME` | `/runpod-volume/cache` |
| `HUGGINGFACE_HUB_CACHE` | `/runpod-volume/cache/hy3dgen` |
| `HF_MODULES_CACHE` | `/workspace/Hunyuan3D-2/hy3dgen/texgen` |
| `MODEL_PATH` | `/runpod-volume/cache/hy3dgen/tencent/Hunyuan3D-2` |
| `TEX_MODEL_PATH` | `/runpod-volume/cache/hy3dgen/tencent/Hunyuan3D-2` |
| `SUBFOLDER` | `hunyuan3d-dit-v2-0` |

---

## API Usage

### Endpoint

```
POST https://api.runpod.ai/v2/{ENDPOINT_ID}/run
```

### Request

```json
{
  "input": {
    "image": "<base64 encoded image>",
    "num_inference_steps": 50,
    "octree_resolution": 384,
    "guidance_scale": 7.5,
    "num_chunks": 200000,
    "face_count": 80000,
    "texture": true,
    "seed": 1234
  }
}
```

### Input Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `image` | string | required | Base64 encoded image (JPG, PNG, WEBP) |
| `num_inference_steps` | int | 30 | Diffusion steps. Higher = better shape, slower |
| `octree_resolution` | int | 256 | Mesh resolution. 256=standard, 384=high |
| `guidance_scale` | float | 7.5 | Diffusion guidance. 5.0-7.5 recommended |
| `num_chunks` | int | 8000 | Mesh decode chunks. 200000=high quality |
| `face_count` | int | 40000 | Max faces after reduction. 80000=high quality |
| `texture` | bool | true | Whether to apply texture |
| `seed` | int | 1234 | Random seed for reproducibility |

### Response

```json
{
  "output": {
    "model_base64": "<base64 encoded GLB file>"
  }
}
```

On error:
```json
{
  "output": {
    "error": "error message",
    "traceback": "full traceback"
  }
}
```

---

## Testing

### Submit a job and poll for result

Save the following as `generate3d.sh`:

```bash
#!/bin/bash
ENDPOINT_ID="your_endpoint_id_here"
API_KEY="your_api_key_here"
IMAGE=$(base64 -i /path/to/your/image.webp | tr -d '\n')

JOB_ID=$(curl -s -X POST "https://api.runpod.ai/v2/${ENDPOINT_ID}/run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{\"input\": {\"image\": \"${IMAGE}\", \"num_inference_steps\": 50, \"octree_resolution\": 384, \"texture\": true, \"seed\": 1234, \"guidance_scale\": 7.5, \"num_chunks\": 200000, \"face_count\": 80000}}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Job submitted: ${JOB_ID}"

while true; do
  RESPONSE=$(curl -s -H "Authorization: Bearer ${API_KEY}" \
    "https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${JOB_ID}")
  STATUS=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "Status: ${STATUS}"
  if [ "$STATUS" = "COMPLETED" ]; then
    echo $RESPONSE | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
glb = base64.b64decode(data['output']['model_base64'])
open('output.glb', 'wb').write(glb)
print('Saved to output.glb')
"
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo "Job failed: $RESPONSE"
    break
  fi
  sleep 10
done
```

```bash
chmod +x generate3d.sh
./generate3d.sh
```

---

## Quality Presets

### Fast (testing)
```json
{
  "num_inference_steps": 5,
  "octree_resolution": 128,
  "num_chunks": 8000,
  "face_count": 40000
}
```

### Standard
```json
{
  "num_inference_steps": 30,
  "octree_resolution": 256,
  "num_chunks": 8000,
  "face_count": 40000
}
```

### High Quality (recommended for production)
```json
{
  "num_inference_steps": 50,
  "octree_resolution": 384,
  "num_chunks": 200000,
  "face_count": 80000
}
```

---

## Cost Estimates

| GPU | Cost/sec | Cost per generation (HQ) |
|---|---|---|
| RTX 4090 PRO 24GB | $0.00031/s | ~$0.065 |
| L4 24GB | $0.00019/s | ~$0.034 |

Cold start adds ~2 minutes on first request. Subsequent warm requests take ~60-90 seconds.

---

## Building the Docker Image

```bash
# Build for linux/amd64 (required for RunPod)
docker buildx build --platform linux/amd64 -t nuthanan06/hunyuan3d-2:v1.4 --push .
```

Files required in build directory:
```
docker-build/
├── Dockerfile
├── Hunyuan3D-2.tar.gz   # repo with all patches applied
└── handler.py
```

---

## Key Patches Applied

The following modifications were made to the original Hunyuan3D-2 repo:

1. **`hy3dgen/texgen/pipelines.py`** — Changed default subfolder from `hunyuan3d-paint-v2-0-turbo` to `hunyuan3d-paint-v2-0`
2. **`hy3dgen/texgen/diffusers_modules/local/modules.py`** — Patched `Basic2p5DTransformerBlock` to use `self.__dict__` for storing attributes (`dim`, `num_attention_heads`, etc.) to avoid PyTorch `nn.Module` `__setattr__` interception
3. **`api_server_fixed.py`** — Custom FastAPI server with Gradio-matching preprocessing

---

## Image Input Tips

For best results:
- Single isolated object
- Clean or transparent background
- Shot straight-on from the front
- Square crop tightly around the object
- Good lighting, no harsh shadows