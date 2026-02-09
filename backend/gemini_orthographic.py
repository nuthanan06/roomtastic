#!/usr/bin/env python3
"""
Small wrapper so the existing Go pipeline can continue calling
`python3 gemini_orthographic.py <input> <outdir>`. This imports and
delegates to `gemini_orthographic_genai.generate_views_with_genai`.
"""

import os
import sys
from urllib import response

def main():
    if len(sys.argv) < 3:
        print("Usage: gemini_orthographic.py <input_image> <output_dir>")
        sys.exit(1)

    input_path = sys.argv[1]
    out_dir = sys.argv[2]

    api_key = os.environ.get('GEMINI_API_KEY')
    model_name = os.environ.get('GEMINI_MODEL') or os.environ.get('GEMINI_GCP_MODEL') or 'gemini-2.5-flash-image'

    try:
        from gemini_orthographic_genai import generate_views_with_genai, fallback_transform
    except Exception as e:
        print(f"Failed to import genai implementation: {e}")
        sys.exit(2)

    if not api_key:
        print('GEMINI_API_KEY not set; using deterministic fallback')
        try:
            fallback_transform(input_path, out_dir)
            sys.exit(0)
        except Exception as e:
            print(f'Fallback transform failed: {e}')
            sys.exit(3)

    res = generate_views_with_genai(api_key, input_path, out_dir, model_name)
    if res:
        print('Generated orthographic views (genai)')
        sys.exit(0)
    else:
        print('genai generation failed; using deterministic fallback')
        try:
            fallback_transform(input_path, out_dir)
            sys.exit(0)
        except Exception as e:
            print(f'Fallback transform failed: {e}')
            sys.exit(4)


if __name__ == '__main__':
    main()
#!/usr/bin/env python3
"""
Small wrapper so the existing Go pipeline can continue calling
`python3 gemini_orthographic.py <input> <outdir>`. This imports and
delegates to `gemini_orthographic_genai.generate_views_with_genai`.
"""

import os
import sys

def main():
    if len(sys.argv) < 3:
        print("Usage: gemini_orthographic.py <input_image> <output_dir>")
        sys.exit(1)

    input_path = sys.argv[1]
    out_dir = sys.argv[2]

    api_key = os.environ.get('GEMINI_API_KEY')
    model_name = os.environ.get('GEMINI_MODEL') or os.environ.get('GEMINI_GCP_MODEL') or 'gemini-2.5-flash-image'

    try:
        from gemini_orthographic_genai import generate_views_with_genai, fallback_transform
    except Exception as e:
        print(f"Failed to import genai implementation: {e}")
        sys.exit(2)

    if not api_key:
        print('GEMINI_API_KEY not set; using deterministic fallback')
        try:
            fallback_transform(input_path, out_dir)
            sys.exit(0)
        except Exception as e:
            print(f'Fallback transform failed: {e}')
            sys.exit(3)

    res = generate_views_with_genai(api_key, input_path, out_dir, model_name)
    if res:
        print('Generated orthographic views (genai)')
        sys.exit(0)
    else:
        print('genai generation failed; using deterministic fallback')
        try:
            fallback_transform(input_path, out_dir)
            sys.exit(0)
        except Exception as e:
            print(f'Fallback transform failed: {e}')
            sys.exit(4)


if __name__ == '__main__':
    main()
#!/usr/bin/env python3
"""
Clean genai-only orthographic generator. Passes a PIL Image to
`client.models.generate_content` (per user's example) and saves six PNGs.
"""

import os
import sys
import base64
from typing import Dict, Optional


def write_bytes_to_file(b: bytes, path: str) -> None:
    with open(path, 'wb') as f:
        f.write(b)


def fallback_transform(input_path: str, out_dir: str) -> None:
    try:
        import cv2
    except Exception as e:
        raise RuntimeError(f"OpenCV not available for fallback transform: {e}")

    os.makedirs(out_dir, exist_ok=True)
    img = cv2.imread(input_path)
    if img is None:
        raise RuntimeError(f"Failed to load {input_path}")

    h, w = img.shape[:2]
    front = cv2.resize(img, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'front.png'), front)
    back = cv2.flip(front, 1)
    cv2.imwrite(os.path.join(out_dir, 'back.png'), back)
    left = cv2.rotate(front, cv2.ROTATE_90_COUNTERCLOCKWISE)
    left = cv2.resize(left, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'left.png'), left)
    right = cv2.rotate(front, cv2.ROTATE_90_CLOCKWISE)
    right = cv2.resize(right, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'right.png'), right)
    top_h = max(1, h // 3)
    top = front[0:top_h, :]
    top = cv2.resize(top, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'top.png'), top)
    bottom = front[h - top_h:h, :]
    bottom = cv2.resize(bottom, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'bottom.png'), bottom)


def generate_views_with_genai(api_key: str, input_path: str, out_dir: str, model_name: str) -> Optional[Dict[str, str]]:
    try:
        from google import genai  # type: ignore
        from PIL import Image
    except Exception as e:
        print(f"google.genai or Pillow not available: {e}")
        return None

    print('Using google.genai client')
    try:
        client = genai.Client(api_key=api_key)
    except Exception:
        try:
            genai.configure(api_key=api_key)  # type: ignore
            client = genai
        except Exception as e:
            print(f"Failed to configure google.genai client: {e}")
            return None

    views = ['front', 'back', 'left', 'right', 'top', 'bottom']
    os.makedirs(out_dir, exist_ok=True)
    results: Dict[str, str] = {}

    for v in views:
        prompt = f"Generate an orthographic {v} view of the object in the provided image, photorealistic, remove background or make it transparent if possible."
        try:
            input_image = Image.open(input_path)
        except Exception as e:
            print(f"Failed to open input image for view {v}: {e}")
            return None

        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[prompt, input_image],
            )
        except Exception as e:
            try:
                print(f"Image input rejected; falling back to prompt-only call for view {v}: {e}")
                response = client.models.generate_content(model=model_name, contents=[prompt])
            except Exception as e2:
                print(f"genai client call failed for view {v}: {e2}")
                return None

        saved = False
        try:
            for part in getattr(response, 'parts', []) or []:
                inline = getattr(part, 'inline_data', None)
                if inline is not None and getattr(inline, 'mime_type', '').startswith('image/'):
                    image_bytes = getattr(inline, 'data', None)
                    out_path = os.path.join(out_dir, f"{v}.png")
                    if image_bytes:
                        if isinstance(image_bytes, (bytes, bytearray)):
                            write_bytes_to_file(image_bytes, out_path)
                        else:
                            try:
                                write_bytes_to_file(base64.b64decode(image_bytes), out_path)
                            except Exception:
                                write_bytes_to_file(str(image_bytes).encode('utf-8'), out_path)
                        results[v] = f"data:image/png;base64,{base64.b64encode(open(out_path,'rb').read()).decode('ascii')}"
                        saved = True
                        break
            if not saved and hasattr(response, 'image'):
                maybe = getattr(response, 'image')
                out_path = os.path.join(out_dir, f"{v}.png")
                if isinstance(maybe, (bytes, bytearray)):
                    write_bytes_to_file(maybe, out_path)
                    results[v] = f"data:image/png;base64,{base64.b64encode(open(out_path,'rb').read()).decode('ascii')}"
                    saved = True
        except Exception as e:
            print(f"Error extracting image for view {v}: {e}")

        if not saved:
            print(f"No image returned for view {v} by genai client")
            return None

    return results


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: gemini_orthographic.py <input_image> <output_dir>")
        sys.exit(1)

    input_path = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    api_key = os.environ.get('GEMINI_API_KEY')
    model_name = os.environ.get('GEMINI_MODEL') or os.environ.get('GEMINI_GCP_MODEL') or 'gemini-2.5-flash-image'

    if api_key:
        data = generate_views_with_genai(api_key, input_path, out_dir, model_name)
        if data:
            print('Generated orthographic views (genai)')
            sys.exit(0)
        else:
            print('genai API failed; falling back to deterministic transform')

    try:
        fallback_transform(input_path, out_dir)
        print('Generated orthographic views (fallback)')
        sys.exit(0)
    except Exception as e:
        print(f'Fallback transform failed: {e}')
        sys.exit(4)


if __name__ == '__main__':
    main()
#!/usr/bin/env python3
"""
Generate six orthographic-like views from a single image using the
`google.genai` client (PIL Image passed directly) and the API key
provided via `GEMINI_API_KEY` in the environment. Falls back to a
deterministic OpenCV transform when the client or network is unavailable.
"""

import os
import sys
import base64
from typing import Dict, Optional


def write_bytes_to_file(b: bytes, path: str) -> None:
    with open(path, 'wb') as f:
        f.write(b)


def fallback_transform(input_path: str, out_dir: str) -> None:
    try:
        import cv2
    except Exception as e:
        raise RuntimeError(f"OpenCV not available for fallback transform: {e}")

    os.makedirs(out_dir, exist_ok=True)
    img = cv2.imread(input_path)
    if img is None:
        raise RuntimeError(f"Failed to load {input_path}")

    h, w = img.shape[:2]
    front = cv2.resize(img, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'front.png'), front)
    back = cv2.flip(front, 1)
    cv2.imwrite(os.path.join(out_dir, 'back.png'), back)
    left = cv2.rotate(front, cv2.ROTATE_90_COUNTERCLOCKWISE)
    left = cv2.resize(left, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'left.png'), left)
    right = cv2.rotate(front, cv2.ROTATE_90_CLOCKWISE)
    right = cv2.resize(right, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'right.png'), right)
    top_h = max(1, h // 3)
    top = front[0:top_h, :]
    top = cv2.resize(top, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'top.png'), top)
    bottom = front[h - top_h:h, :]
    bottom = cv2.resize(bottom, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'bottom.png'), bottom)


def generate_views_with_genai(api_key: str, input_path: str, out_dir: str, model_name: str) -> Optional[Dict[str, str]]:
    """Call `google.genai` and pass a PIL Image object together with the prompt.
    Returns a dict mapping view -> data-uri on success, or None on failure.
    """
    try:
        from google import genai  # type: ignore
        from PIL import Image
        from io import BytesIO
    except Exception as e:
        print(f"google.genai or Pillow not available: {e}")
        return None

    print('Using google.genai client')
    try:
        client = genai.Client(api_key=api_key)
    except Exception:
        try:
            genai.configure(api_key=api_key)  # type: ignore
            client = genai
        except Exception as e:
            print(f"Failed to configure google.genai client: {e}")
            return None

    views = ['front', 'back', 'left', 'right', 'top', 'bottom']
    os.makedirs(out_dir, exist_ok=True)
    results: Dict[str, str] = {}

    for v in views:
        prompt = f"Generate an orthographic {v} view of the object in the provided image, photorealistic, remove background or make it transparent if possible."
        try:
            input_image = Image.open(input_path)
        except Exception as e:
            print(f"Failed to open input image for view {v}: {e}")
            return None

        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[prompt, input_image],
            )
        except Exception as e:
            # Try prompt-only fallback
            try:
                print(f"Image input rejected; falling back to prompt-only call for view {v}: {e}")
                response = client.models.generate_content(model=model_name, contents=[prompt])
            except Exception as e2:
                print(f"genai client call failed for view {v}: {e2}")
                return None

        saved = False
        try:
            for part in getattr(response, 'parts', []) or []:
                inline = getattr(part, 'inline_data', None)
                if inline is not None and getattr(inline, 'mime_type', '').startswith('image/'):
                    image_bytes = getattr(inline, 'data', None)
                    out_path = os.path.join(out_dir, f"{v}.png")
                    if image_bytes:
                        if isinstance(image_bytes, (bytes, bytearray)):
                            write_bytes_to_file(image_bytes, out_path)
                        else:
                            try:
                                write_bytes_to_file(base64.b64decode(image_bytes), out_path)
                            except Exception:
                                write_bytes_to_file(str(image_bytes).encode('utf-8'), out_path)
                        results[v] = f"data:image/png;base64,{base64.b64encode(open(out_path,'rb').read()).decode('ascii')}"
                        saved = True
                        break
            # Some client versions return image bytes on a top-level attribute
            if not saved and hasattr(response, 'image'):
                maybe = getattr(response, 'image')
                out_path = os.path.join(out_dir, f"{v}.png")
                if isinstance(maybe, (bytes, bytearray)):
                    write_bytes_to_file(maybe, out_path)
                    results[v] = f"data:image/png;base64,{base64.b64encode(open(out_path,'rb').read()).decode('ascii')}"
                    saved = True
        except Exception as e:
            print(f"Error extracting image for view {v}: {e}")

        if not saved:
            print(f"No image returned for view {v} by genai client")
            return None

    return results


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: gemini_orthographic.py <input_image> <output_dir>")
        sys.exit(1)

    input_path = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    api_key = os.environ.get('GEMINI_API_KEY')
    model_name = os.environ.get('GEMINI_MODEL') or os.environ.get('GEMINI_GCP_MODEL') or 'gemini-2.5-flash-image'

    if api_key:
        data = generate_views_with_genai(api_key, input_path, out_dir, model_name)
        if data:
            print('Generated orthographic views (genai)')
            sys.exit(0)
        else:
            print('genai API failed; falling back to deterministic transform')

    try:
        fallback_transform(input_path, out_dir)
        print('Generated orthographic views (fallback)')
        sys.exit(0)
    except Exception as e:
        print(f'Fallback transform failed: {e}')
        sys.exit(4)


if __name__ == '__main__':
    main()
#!/usr/bin/env python3
"""
Generate six orthographic-like views from a single image using the
`google.genai` client and the API key provided via `GEMINI_API_KEY` in
.env. If the client or API call fails, a deterministic OpenCV fallback
is used so the rest of the pipeline continues to work.

This simplified script intentionally omits provider/URL/local modes and
only relies on the API key in the environment as you requested.
"""

import os
import sys
import base64
from typing import Dict, Optional


def write_bytes_to_file(b: bytes, path: str) -> None:
    with open(path, 'wb') as f:
        f.write(b)


def fallback_transform(input_path: str, out_dir: str) -> None:
    """Deterministic OpenCV transforms used when API is not available."""
    try:
        import cv2
    except Exception as e:
        raise RuntimeError(f"OpenCV not available for fallback transform: {e}")

    os.makedirs(out_dir, exist_ok=True)
    img = cv2.imread(input_path)
    if img is None:
        raise RuntimeError(f"Failed to load {input_path}")

    h, w = img.shape[:2]
    front = cv2.resize(img, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'front.png'), front)
    back = cv2.flip(front, 1)
    cv2.imwrite(os.path.join(out_dir, 'back.png'), back)
    left = cv2.rotate(front, cv2.ROTATE_90_COUNTERCLOCKWISE)
    left = cv2.resize(left, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'left.png'), left)
    right = cv2.rotate(front, cv2.ROTATE_90_CLOCKWISE)
    right = cv2.resize(right, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'right.png'), right)
    top_h = max(1, h // 3)
    top = front[0:top_h, :]
    top = cv2.resize(top, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'top.png'), top)
    bottom = front[h - top_h:h, :]
    bottom = cv2.resize(bottom, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'bottom.png'), bottom)


def generate_views_with_genai(api_key: str, input_path: str, out_dir: str, model_name: str) -> Optional[Dict[str, str]]:
    """Use `from google import genai` and `client.models.generate_content` to
    create six orthographic views. Returns a dict of data-URIs on success,
    or None on failure.
    """
    try:
        from google import genai  # type: ignore
    except Exception as e:
        print(f"google.genai client not available: {e}")
        return None

    print('Using google.genai client')
    try:
        # Preferred constructor
        client = genai.Client(api_key=api_key)
    except Exception:
        # Some versions use configure()
        try:
            genai.configure(api_key=api_key)  # type: ignore
            client = genai
        except Exception as e:
            print(f"Failed to configure google.genai client: {e}")
            return None

    views = ['front', 'back', 'left', 'right', 'top', 'bottom']
    os.makedirs(out_dir, exist_ok=True)
    results: Dict[str, str] = {}

    for v in views:
        prompt = f"Generate an orthographic {v} view of the object in the provided image, photorealistic, remove background or make it transparent if possible."
        response = None
        # Try several ways of sending the image: file-like, raw bytes, and base64 dict
        attempts = []
        try:
            with open(input_path, 'rb') as f:
                raw = f.read()
            attempts = [
                [prompt, open(input_path, 'rb')],
                [prompt, raw],
                [prompt, {'data': base64.b64encode(raw).decode('ascii'), 'mime_type': 'image/png'}],
            ]
        except Exception as e:
            print(f"Failed to read input image for view {v}: {e}")
            return None

        for contents in attempts:
            try:
                # Ensure file-likes are re-opened when needed
                response = client.models.generate_content(model=model_name, contents=contents)
                break
            except Exception as e:
                # try next shape
                last_err = e
                continue

        if response is None:
            # As a last resort, try calling with the prompt only (may produce a generic image)
            try:
                print(f"Falling back to prompt-only call for view {v}")
                response = client.models.generate_content(model=model_name, contents=[prompt])
            except Exception as e:
                print(f"genai client call failed for view {v}: {e}")
                return None

        # Extract image bytes from response.parts (resilient to client shapes)
        saved = False
        try:
            for part in getattr(response, 'parts', []) or []:
                inline = getattr(part, 'inline_data', None)
                if inline is not None and getattr(inline, 'mime_type', '').startswith('image/'):
                    image_bytes = getattr(inline, 'data', None)
                    out_path = os.path.join(out_dir, f"{v}.png")
                    if image_bytes:
                        if isinstance(image_bytes, (bytes, bytearray)):
                            write_bytes_to_file(image_bytes, out_path)
                        else:
                            # assume base64 string
                            try:
                                write_bytes_to_file(base64.b64decode(image_bytes), out_path)
                            except Exception:
                                write_bytes_to_file(str(image_bytes).encode('utf-8'), out_path)
                        results[v] = f"data:image/png;base64,{base64.b64encode(open(out_path,'rb').read()).decode('ascii')}"
                        saved = True
                        break
        except Exception as e:
            print(f"Error extracting image for view {v}: {e}")

        if not saved:
            print(f"No image returned for view {v} by genai client")
            return None

    return results


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: gemini_orthographic.py <input_image> <output_dir>")
        sys.exit(1)

    input_path = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    api_key = os.environ.get('GEMINI_API_KEY')
    model_name = os.environ.get('GEMINI_MODEL') or os.environ.get('GEMINI_GCP_MODEL') or 'gemini-2.5-flash-image'

    from PIL import Image
    from io import BytesIO

    for v in views:
        prompt = f"Generate an orthographic {v} view of the object in the provided image, photorealistic, remove background or make it transparent if possible."
        # Open the image with PIL and pass the Image object directly (as in your example)
        try:
            input_image = Image.open(input_path)
        except Exception as e:
            print(f"Failed to open input image for view {v}: {e}")
            return None

        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[prompt, input_image],
            )
        except Exception as e:
            # Try prompt-only fallback before giving up
            try:
                print(f"Image input rejected; falling back to prompt-only call for view {v}: {e}")
                response = client.models.generate_content(model=model_name, contents=[prompt])
            except Exception as e2:
                print(f"genai client call failed for view {v}: {e2}")
                return None

import os
import sys
import base64
import json
import subprocess
from typing import Dict, Optional


def write_bytes_to_file(b: bytes, path: str) -> None:
    with open(path, 'wb') as f:
        f.write(b)


def fallback_transform(input_path: str, out_dir: str) -> None:
    """Deterministic OpenCV transforms used when no model is available."""
    try:
        import cv2
    except Exception as e:
        raise RuntimeError(f"OpenCV not available for fallback transform: {e}")

    os.makedirs(out_dir, exist_ok=True)
    img = cv2.imread(input_path)
    if img is None:
        raise RuntimeError(f"Failed to load {input_path}")

    h, w = img.shape[:2]
    front = cv2.resize(img, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'front.png'), front)
    back = cv2.flip(front, 1)
    cv2.imwrite(os.path.join(out_dir, 'back.png'), back)
    left = cv2.rotate(front, cv2.ROTATE_90_COUNTERCLOCKWISE)
    left = cv2.resize(left, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'left.png'), left)
    right = cv2.rotate(front, cv2.ROTATE_90_CLOCKWISE)
    right = cv2.resize(right, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'right.png'), right)
    top_h = max(1, h // 3)
    top = front[0:top_h, :]
    top = cv2.resize(top, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'top.png'), top)
    bottom = front[h - top_h:h, :]
    bottom = cv2.resize(bottom, (w, h))
    cv2.imwrite(os.path.join(out_dir, 'bottom.png'), bottom)


def run_local_cli(cmd_template: str, input_path: str, out_dir: str) -> int:
    cmd = cmd_template.format(input=input_path, outdir=out_dir)
    print(f"Running local Gemini CLI: {cmd}")
    try:
        res = subprocess.run(cmd, shell=True, check=False, capture_output=True, text=True)
        print(res.stdout)
        if res.returncode != 0:
            print(res.stderr)
        return res.returncode
    except Exception as e:
        print(f"Local CLI invocation failed: {e}")
        return 1


def try_google_genai_client(api_key: str, input_path: str, out_dir: str, model_name: str) -> Optional[Dict[str, str]]:
    """Use `from google import genai` client as in the snippet provided by user."""
    try:
        from google import genai  # type: ignore
        from PIL import Image
        from io import BytesIO
    except Exception as e:
        print(f"google.genai client not available: {e}")
        return None

    print('Using google.genai client')
    try:
        client = genai.Client(api_key=api_key)
    except Exception:
        # older/newer client constructors vary; try configure if present
        try:
            genai.configure(api_key=api_key)  # type: ignore
            client = genai
        except Exception as e:
            print(f"Failed to configure google.genai client: {e}")
            return None

    views = ['front', 'back', 'left', 'right', 'top', 'bottom']
    os.makedirs(out_dir, exist_ok=True)
    results: Dict[str, str] = {}

    # We'll pass the binary file object directly (some client versions accept file-likes)
    for v in views:
        prompt = f"Generate an orthographic {v} view of the object in the provided image, photorealistic, remove background or make it transparent if possible."
        try:
            # Some genai client versions accept a file URI + mime_type dict as content
            file_uri = 'file://' + os.path.abspath(input_path)
            response = client.models.generate_content(
                model=model_name,
                contents=[prompt, {'uri': file_uri, 'mime_type': 'image/png'}],
            )
        except Exception as e:
            print(f"genai client call failed for view {v}: {e}")
            return None

        # Extract image bytes from response.parts
        saved = False
        try:
            for part in getattr(response, 'parts', []) or []:
                inline = getattr(part, 'inline_data', None)
                if inline is not None and getattr(inline, 'mime_type', '') == 'image/png':
                    image_bytes = getattr(inline, 'data', None)
                    if image_bytes:
                        out_path = os.path.join(out_dir, f"{v}.png")
                        # inline.data may be bytes
                        if isinstance(image_bytes, (bytes, bytearray)):
                            write_bytes_to_file(image_bytes, out_path)
                        else:
                            # if it's base64 string
                            try:
                                write_bytes_to_file(base64.b64decode(image_bytes), out_path)
                            except Exception:
                                # try str->bytes
                                write_bytes_to_file(str(image_bytes).encode('utf-8'), out_path)
                        results[v] = f"data:image/png;base64,{base64.b64encode(open(out_path,'rb').read()).decode('ascii')}"
                        saved = True
                        break
        except Exception as e:
            print(f"Error extracting image for view {v}: {e}")

        if not saved:
            print(f"No image returned for view {v} by genai client")
            return None

    return results


def try_google_generativeai_client(api_key: str, input_path: str, out_dir: str, model_name: str) -> Optional[Dict[str, str]]:
    """Try older/newer google.generativeai client patterns (resilient)."""
    try:
        import google.generativeai as genai
    except Exception as e:
        print(f"google.generativeai client not available: {e}")
        return None

    print('Using google.generativeai client')
    try:
        genai.configure(api_key=api_key)
    except Exception:
        pass

    views = ['front', 'back', 'left', 'right', 'top', 'bottom']
    os.makedirs(out_dir, exist_ok=True)
    results: Dict[str, str] = {}

    for v in views:
        prompt = f"Generate an orthographic {v} view of the object in the provided image, photorealistic, remove background or make it transparent if possible."
        try:
            # try images.generate
            if hasattr(genai, 'images') and hasattr(genai.images, 'generate'):
                resp = genai.images.generate(model=model_name, image=open(input_path, 'rb'), prompt=prompt, size='1024x1024')
                # resp may be dict-like
                artifacts = None
                if isinstance(resp, dict):
                    artifacts = resp.get('artifacts')
                else:
                    artifacts = getattr(resp, 'artifacts', None)
                if artifacts and len(artifacts) > 0:
                    b64 = artifacts[0].get('b64_json') if isinstance(artifacts[0], dict) else getattr(artifacts[0], 'b64_json', None)
                    if b64:
                        out_path = os.path.join(out_dir, f"{v}.png")
                        write_bytes_to_file(base64.b64decode(b64), out_path)
                        results[v] = f"data:image/png;base64,{b64}"
                        try:
                            for part in getattr(response, 'parts', []) or []:
                                inline = getattr(part, 'inline_data', None)
                                if inline is not None and getattr(inline, 'mime_type', '').startswith('image/'):
                                    image_bytes = getattr(inline, 'data', None)
                                    out_path = os.path.join(out_dir, f"{v}.png")
                                    if image_bytes:
                                        # If bytes-like, write raw bytes; if base64 string, decode first
                                        if isinstance(image_bytes, (bytes, bytearray)):
                                            write_bytes_to_file(image_bytes, out_path)
                                        else:
                                            try:
                                                write_bytes_to_file(base64.b64decode(image_bytes), out_path)
                                            except Exception:
                                                # If the client returned a python bytes-like in str repr, try to handle
                                                write_bytes_to_file(str(image_bytes).encode('utf-8'), out_path)
                                        results[v] = f"data:image/png;base64,{base64.b64encode(open(out_path,'rb').read()).decode('ascii')}"
                                        saved = True
                                        break
                            # If the client returned a top-level `image` attribute (some clients), handle that too
                            if not saved and hasattr(response, 'image'):
                                maybe = getattr(response, 'image')
                                out_path = os.path.join(out_dir, f"{v}.png")
                                if isinstance(maybe, (bytes, bytearray)):
                                    write_bytes_to_file(maybe, out_path)
                                    results[v] = f"data:image/png;base64,{base64.b64encode(open(out_path,'rb').read()).decode('ascii')}"
                                    saved = True
                        except Exception as e:
                            print(f"Error extracting image for view {v}: {e}")
        except Exception as e:
            print(f"generativeai client call failed for view {v}: {e}")
            return None
    
    return results


def api_mode_call(api_url: Optional[str], api_key: str, input_path: str) -> Optional[Dict[str, str]]:
    """Top-level API call: try google.genai client, then google.generativeai, then HTTP POST."""
    # prefer direct client flow for Google
    provider = os.environ.get('GEMINI_PROVIDER', '').lower()
    model_name = os.environ.get('GEMINI_GCP_MODEL') or os.environ.get('GEMINI_MODEL') or 'gemini-2.5-flash-image'

    if provider == 'google' or (api_url and 'googleapis' in api_url):
        # try google.genai client (user-provided snippet)
        res = try_google_genai_client(api_key, input_path, os.path.dirname(input_path) or '.', model_name)
        if res:
            return res
        # try google.generativeai
        res2 = try_google_generativeai_client(api_key, input_path, os.path.dirname(input_path) or '.', model_name)
        if res2:
            return res2

    # HTTP POST fallback
    try:
        import requests
    except Exception:
        requests = None

    if not api_url or requests is None:
        print('No HTTP API URL configured or requests not available; skipping HTTP POST')
        return None

    headers = {'Authorization': f'Bearer {api_key}'}
    files = {'image': open(input_path, 'rb')}
    try:
        print(f"Calling Gemini API at {api_url} via HTTP POST...")
        resp = requests.post(api_url, headers=headers, files=files, timeout=120)
        if resp.status_code != 200:
            print(f"API returned {resp.status_code}: {resp.text}")
            return None
        data = resp.json()
        return data
    except Exception as e:
        print(f"HTTP API call failed: {e}")
        return None


def main():
    if len(sys.argv) < 3:
        print("Usage: gemini_orthographic.py <input_image> <output_dir>")
        sys.exit(1)

    input_path = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    mode = os.environ.get('GEMINI_MODE', '').lower()

    if mode == 'local':
        cmd = os.environ.get('GEMINI_LOCAL_CMD')
        if not cmd:
            print('GEMINI_LOCAL_CMD is required for local mode')
            sys.exit(2)
        rc = run_local_cli(cmd, input_path, out_dir)
        if rc != 0:
            print(f'Local CLI returned {rc}; falling back to deterministic transform')
            try:
                fallback_transform(input_path, out_dir)
                print('Fallback generated views')
                sys.exit(0)
            except Exception as e:
                print(f'Fallback also failed: {e}')
                sys.exit(3)
        print('Generated orthographic views (local CLI mode)')
        sys.exit(0)

    api_key = os.environ.get('GEMINI_API_KEY')
    api_url = os.environ.get('GEMINI_API_URL')
    provider = os.environ.get('GEMINI_PROVIDER', '').lower()

    if api_key:
        data = api_mode_call(api_url, api_key, input_path)
        if data:
            # Expect keys front/back/left/right/top/bottom with base64 or data URIs
            expected = ['front', 'back', 'left', 'right', 'top', 'bottom']
            for k in expected:
                if k in data and data[k]:
                    val = data[k]
                    if isinstance(val, str) and val.startswith('data:'):
                        b64 = val.split(',', 1)[1]
                    else:
                        b64 = val
                    try:
                        write_bytes_to_file(base64.b64decode(b64), os.path.join(out_dir, f"{k}.png"))
                    except Exception as e:
                        print(f"Failed to write {k} from API: {e}")
                else:
                    print(f"API response missing {k}; generating fallback for that view")
                    fallback_transform(input_path, out_dir)
                    break
            print('Generated orthographic views (API mode)')
            sys.exit(0)
        else:
            print('API mode failed, falling back to local transform')

    # Final fallback: deterministic transform
    try:
        fallback_transform(input_path, out_dir)
        print('Generated orthographic views (fallback)')
        sys.exit(0)
    except Exception as e:
        print(f'Fallback transform failed: {e}')
        sys.exit(4)


if __name__ == '__main__':
    main()
#!/usr/bin/env python3
"""
Generate six orthographic-like views from a single image.
This is a placeholder for a real Gemini / multimodal model.
It performs deterministic image transforms to produce front/back/left/right/top/bottom.
"""
import sys
import os
import cv2

def save_image(img, path):
    cv2.imwrite(path, img)

def main():
    if len(sys.argv) < 3:
        print("Usage: gemini_orthographic.py <input_image> <output_dir>")
        sys.exit(1)

    input_path = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    img = cv2.imread(input_path)
    if img is None:
        print(f"Failed to load {input_path}")
        sys.exit(1)

    h, w = img.shape[:2]

    # front: original resized
    front = cv2.resize(img, (w, h))
    save_image(front, os.path.join(out_dir, 'front.png'))

    # back: horizontal flip
    back = cv2.flip(front, 1)
    save_image(back, os.path.join(out_dir, 'back.png'))

    # left: rotate 90 CCW
    left = cv2.rotate(front, cv2.ROTATE_90_COUNTERCLOCKWISE)
    left = cv2.resize(left, (w, h))
    save_image(left, os.path.join(out_dir, 'left.png'))

    #!/usr/bin/env python3
    """
    gemini_orthographic.py

    Integrates with the "Nano Bannono" / Gemini-style service to produce six
    orthographic views from a single image. The script supports three modes:

    - API mode: set `GEMINI_MODE=api`, and provide `GEMINI_API_URL` and
      `GEMINI_API_KEY`. The script will POST the input image and expect a JSON
      response containing base64 images for keys `front, back, left, right, top, bottom`.

    - Local CLI mode: set `GEMINI_MODE=local` and provide `GEMINI_LOCAL_CMD` — a
      shell command template where `{input}` and `{outdir}` will be substituted.

    - Fallback (no GEMINI_* env): use a lightweight deterministic OpenCV
      transformation (same behaviour as the previous placeholder) so the rest of
      the pipeline continues to work.

    The script writes PNG files named `front.png`, `back.png`, `left.png`,
    `right.png`, `top.png`, `bottom.png` into the provided output directory.
    """

    import os
    import sys
    import base64
    import json
    import subprocess
    from typing import Dict, Optional

    try:
        import requests
    except Exception:
        requests = None

    try:
        from PIL import Image
        from io import BytesIO
        import cv2
        import numpy as np
    except Exception:
        # If dependencies are missing, the script will fail later with a helpful message
        pass


    def write_bytes_to_file(b: bytes, path: str) -> None:
        with open(path, 'wb') as f:
            f.write(b)


    def decode_and_save(base64str: str, outpath: str) -> bool:
        """Accept either data URI or raw base64 and write PNG bytes to outpath."""
        try:
            if base64str.startswith('data:'):
                base64str = base64str.split(',', 1)[1]
            b = base64.b64decode(base64str)
            write_bytes_to_file(b, outpath)
            return True
        except Exception as e:
            print(f"Failed to decode/save {outpath}: {e}")
            return False


    def run_local_cli(cmd_template: str, input_path: str, out_dir: str) -> int:
        cmd = cmd_template.format(input=input_path, outdir=out_dir)
        print(f"Running local Gemini CLI: {cmd}")
        try:
            res = subprocess.run(cmd, shell=True, check=False, capture_output=True, text=True)
            print(res.stdout)
            if res.returncode != 0:
                print(res.stderr)
            return res.returncode
        except Exception as e:
            print(f"Local CLI invocation failed: {e}")
            return 1


    def api_mode_call(api_url: str, api_key: str, input_path: str) -> Optional[Dict[str, str]]:
        if requests is None:
            print("requests package is not available; cannot use API mode.")
            return None
        # Prefer provider-specific client if available (Google Generative AI)
        try:
            # If user intends to use Google provider, try the google.generativeai client
            import google.generativeai as genai  # type: ignore
            print('google.generativeai available — attempting client call')
            try:
                genai.configure(api_key=api_key)
            except Exception:
                # older/newer clients may use a different configure API; ignore here
                pass

            model_name = os.environ.get('GEMINI_GCP_MODEL') or os.environ.get('GEMINI_MODEL') or 'gemini-1.5-flash'
            views = ['front', 'back', 'left', 'right', 'top', 'bottom']
            out = {}

            # Try multiple possible client APIs; be resilient to client library versions.
            for v in views:
                prompt = f"Generate an orthographic {v} view of the object in the provided image, photorealistic, no background, transparent background if possible."
                img_b64 = None
                try:
                    # preferred pattern: genai.images.generate
                    if hasattr(genai, 'images') and hasattr(genai.images, 'generate'):
                        resp = genai.images.generate(model=model_name, image=open(input_path, 'rb'), prompt=prompt, size='1024x1024')
                        # response shapes differ between versions
                        if isinstance(resp, dict) and 'artifacts' in resp:
                            # expect base64 data
                            artifacts = resp.get('artifacts')
                            if artifacts and isinstance(artifacts, list):
                                img_b64 = artifacts[0].get('b64_json') or artifacts[0].get('base64')
                        else:
                            # try attribute access
                            try:
                                artifacts = getattr(resp, 'artifacts', None)
                                if artifacts and len(artifacts) > 0:
                                    img_b64 = getattr(artifacts[0], 'b64_json', None) or getattr(artifacts[0], 'base64', None)
                            except Exception:
                                pass
                    # alternate pattern: genai.generate (text-image mixed)
                    elif hasattr(genai, 'generate'):
                        resp = genai.generate(model=model_name, prompt=prompt, image=open(input_path, 'rb'))
                        # try to extract image
                        if isinstance(resp, dict) and 'candidates' in resp:
                            c = resp.get('candidates')
                            if c and isinstance(c, list):
                                img_b64 = c[0].get('image') or c[0].get('b64_json')
                    else:
                        print('google.generativeai found but no known image-generation API present; falling back to HTTP')
                except Exception as e:
                    print(f'google.generativeai call for view {v} failed: {e}')

                if img_b64:
                    out[v] = f'data:image/png;base64,{img_b64}' if not img_b64.startswith('data:') else img_b64
                else:
                    print(f'No image received for view {v} from client — will stop client attempts and return None')
                    out = None
                    break

            if out:
                return out
            print('google.generativeai client did not produce all views — falling back to HTTP approach')
        except Exception:
            # client not installed or failed; fall back to HTTP below
            pass

        if requests is None:
            print("requests package is not available; cannot use HTTP API mode.")
            return None
        headers = {'Authorization': f'Bearer {api_key}'}
        files = {'image': open(input_path, 'rb')}
        try:
            print(f"Calling Gemini API at {api_url} via HTTP POST...")
            resp = requests.post(api_url, headers=headers, files=files, timeout=120)
            if resp.status_code != 200:
                print(f"API returned {resp.status_code}: {resp.text}")
                return None
            data = resp.json()
            return data
        except Exception as e:
            print(f"API call failed: {e}")
            return None


    def fallback_transform(input_path: str, out_dir: str) -> None:
        # original placeholder behaviour using OpenCV
        import cv2

        def save_image(img, path):
            cv2.imwrite(path, img)

        img = cv2.imread(input_path)
        if img is None:
            raise RuntimeError(f"Failed to load {input_path}")

        h, w = img.shape[:2]
        front = cv2.resize(img, (w, h))
        save_image(front, os.path.join(out_dir, 'front.png'))
        back = cv2.flip(front, 1)
        save_image(back, os.path.join(out_dir, 'back.png'))
        left = cv2.rotate(front, cv2.ROTATE_90_COUNTERCLOCKWISE)
        left = cv2.resize(left, (w, h))
        save_image(left, os.path.join(out_dir, 'left.png'))
        right = cv2.rotate(front, cv2.ROTATE_90_CLOCKWISE)
        right = cv2.resize(right, (w, h))
        save_image(right, os.path.join(out_dir, 'right.png'))
        top_h = max(1, h // 3)
        top = front[0:top_h, :]
        top = cv2.resize(top, (w, h))
        save_image(top, os.path.join(out_dir, 'top.png'))
        bottom = front[h-top_h:h, :]
        bottom = cv2.resize(bottom, (w, h))
        save_image(bottom, os.path.join(out_dir, 'bottom.png'))


    def main():
        if len(sys.argv) < 3:
            print("Usage: gemini_orthographic.py <input_image> <output_dir>")
            sys.exit(1)

        input_path = sys.argv[1]
        out_dir = sys.argv[2]
        os.makedirs(out_dir, exist_ok=True)

        mode = os.environ.get('GEMINI_MODE', '').lower()

        # Determine if API mode should be used. Support two workflows:
        # 1) Explicit: GEMINI_MODE=api and user provided GEMINI_API_URL and GEMINI_API_KEY
        # 2) API-key-only: user provides GEMINI_API_KEY and GEMINI_PROVIDER (e.g. 'google' or 'aistudio')
        api_mode_explicit = (mode == 'api')
        api_key = os.environ.get('GEMINI_API_KEY')
        api_url = os.environ.get('GEMINI_API_URL')
        provider = os.environ.get('GEMINI_PROVIDER', '').lower()

        use_api = api_mode_explicit or (api_key is not None and api_url is None and provider)

        # API mode
        if use_api:
            # If an explicit URL wasn't provided, map common providers to a templated URL.
            if not api_url:
                provider_map = {
                    'google': 'https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/models/{model}:predict',
                    'aistudio': 'https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/models/{model}:predict',
                }
                if provider in provider_map:
                    api_url = provider_map[provider]
                    # Try to fill template with optional env vars for convenience
                    gcp_project = os.environ.get('GEMINI_GCP_PROJECT') or os.environ.get('GEMINI_PROJECT')
                    gcp_location = os.environ.get('GEMINI_GCP_LOCATION') or os.environ.get('GEMINI_LOCATION') or 'us-central1'
                    gcp_model = os.environ.get('GEMINI_GCP_MODEL') or os.environ.get('GEMINI_MODEL') or 'nano-bannono'
                    if '{project}' in api_url and gcp_project:
                        api_url = api_url.replace('{project}', gcp_project)
                    if '{location}' in api_url and gcp_location:
                        api_url = api_url.replace('{location}', gcp_location)
                    if '{model}' in api_url and gcp_model:
                        api_url = api_url.replace('{model}', gcp_model)
                    print(f"Inferred API URL for provider '{provider}': {api_url}")
                else:
                    print(f"Unknown GEMINI_PROVIDER '{provider}' and no GEMINI_API_URL set. Please set GEMINI_API_URL or choose a supported provider (google, aistudio).")
                    # continue — api_mode_call will fail gracefully if api_url is None

            if not api_key:
                print('GEMINI_API_KEY is required for API mode')
                sys.exit(2)
            data = api_mode_call(api_url, api_key, input_path)
            if not data:
                print('API mode failed, falling back to local transform')
                try:
                    fallback_transform(input_path, out_dir)
                    print('Fallback generated views')
                    sys.exit(0)
                except Exception as e:
                    print(f'Fallback also failed: {e}')
                    sys.exit(3)

            # Expect keys front/back/left/right/top/bottom with base64 or data URIs
            expected = ['front', 'back', 'left', 'right', 'top', 'bottom']
            for k in expected:
                if k in data and data[k]:
                    ok = decode_and_save(data[k], os.path.join(out_dir, f"{k}.png"))
                    if not ok:
                        print(f"Failed to write {k}")
                else:
                    print(f"API response missing {k}; generating fallback for that view")
                    # generate a simple fallback for missing keys
                    fallback_transform(input_path, out_dir)
                    break

            print('Generated orthographic views (API mode)')
            sys.exit(0)

        # Local CLI mode
        if mode == 'local':
            cmd = os.environ.get('GEMINI_LOCAL_CMD')
            if not cmd:
                print('GEMINI_LOCAL_CMD is required for local mode')
                sys.exit(2)
            rc = run_local_cli(cmd, input_path, out_dir)
            if rc != 0:
                print(f'Local CLI returned {rc}; falling back to deterministic transform')
                try:
                    fallback_transform(input_path, out_dir)
                    print('Fallback generated views')
                    sys.exit(0)
                except Exception as e:
                    print(f'Fallback also failed: {e}')
                    sys.exit(3)
            print('Generated orthographic views (local CLI mode)')
            sys.exit(0)

        # Default: no GEMINI config — run fallback deterministic transform
        print('No GEMINI_MODE configured — using fallback deterministic transforms')
        try:
            fallback_transform(input_path, out_dir)
            print('Generated orthographic views (fallback)')
            sys.exit(0)
        except Exception as e:
            print(f'Fallback transform failed: {e}')
            sys.exit(4)


    if __name__ == '__main__':
        main()
