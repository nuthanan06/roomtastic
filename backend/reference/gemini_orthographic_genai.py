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
	try:
		from google import genai  # type: ignore
		from PIL import Image
	except Exception as e:
		print(f"google.genai or Pillow not available: {e}")
		return None

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
		prompt = (
			f"Generate an orthographic {v} view of the object in the provided image, photorealistic. "
			"Do not alter or stylize the object: preserve colors, proportions, and overall layout. "
			"Produce a clean orthographic view (no added elements); remove background or make it transparent if possible."
		)
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
		print("Usage: gemini_orthographic_genai.py <input_image> <output_dir>")
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

