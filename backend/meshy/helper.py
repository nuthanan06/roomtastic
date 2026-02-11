


import os
import time
import requests
from typing import Optional, Dict, Any
from dotenv import load_dotenv


class MeshyHelper:
    def __init__(self, name: str, description: str, image_url: str):
        self.name = name
        self.description = description
        self.image_url = image_url

        load_dotenv() 
        # API config from environment
        self.api_key = os.environ.get("MESHY_API_KEY")
        self.base_url = os.environ.get("MESHY_API_BASE", "https://api.meshy.ai")

    def _headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise RuntimeError("MESHY_API_KEY not set in environment")
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def create_image_to_3d(self, image_url: str, *,
                           model_type: Optional[str] = None,
                           ai_model: Optional[str] = None,
                           topology: Optional[str] = None,
                           target_polycount: Optional[int] = None,
                           symmetry_mode: Optional[str] = None,
                           should_remesh: Optional[bool] = None,
                           save_pre_remeshed_model: Optional[bool] = None,
                           should_texture: Optional[bool] = None,
                           enable_pbr: Optional[bool] = None,
                           pose_mode: Optional[str] = None,
                           texture_prompt: Optional[str] = None,
                           texture_image_url: Optional[str] = None,
                           moderation: Optional[bool] = None,
                           extra: Optional[Dict[str, Any]] = None) -> str:
        """
        Create an Image-to-3D task on Meshy. Returns the task id string on success.

        :param image_url: public URL or data URI of the image
        :param extra: dict of additional raw parameters to pass
        :raises RuntimeError on failure
        """
        url = f"{self.base_url}/openapi/v1/image-to-3d"
        payload: Dict[str, Any] = {"image_url": image_url}
        # only include optional params when provided
        if model_type is not None:
            payload["model_type"] = model_type
        if ai_model is not None:
            payload["ai_model"] = ai_model
        if topology is not None:
            payload["topology"] = topology
        if target_polycount is not None:
            payload["target_polycount"] = target_polycount
        if symmetry_mode is not None:
            payload["symmetry_mode"] = symmetry_mode
        if should_remesh is not None:
            payload["should_remesh"] = should_remesh
        if save_pre_remeshed_model is not None:
            payload["save_pre_remeshed_model"] = save_pre_remeshed_model
        if should_texture is not None:
            payload["should_texture"] = should_texture
        if enable_pbr is not None:
            payload["enable_pbr"] = enable_pbr
        if pose_mode is not None:
            payload["pose_mode"] = pose_mode
        if texture_prompt is not None:
            payload["texture_prompt"] = texture_prompt
        if texture_image_url is not None:
            payload["texture_image_url"] = texture_image_url
        if moderation is not None:
            payload["moderation"] = moderation
        if extra:
            payload.update(extra)

        resp = requests.post(url, json=payload, headers=self._headers(), timeout=60)
        try:
            resp.raise_for_status()
        except requests.HTTPError as e:
            raise RuntimeError(f"Meshy create task failed: {e} - {resp.text}")

        # According to Meshy docs the response contains: { "result": "<task-id>" }
        data = resp.json()
        task_id = data.get("result")
        if not isinstance(task_id, str) or task_id.strip() == "":
            # defensive fallback: also accept top-level id field
            task_id = data.get("id")
        if not isinstance(task_id, str) or task_id.strip() == "":
            raise RuntimeError(f"Unexpected create response (missing result/id): {data}")
        task_id = task_id.strip()
        # Return the task id string as provided by the API (do not mutate format)
        print("this is the new task id", task_id)
        return task_id

    def get_image_to_3d(self, task_id: str) -> Dict[str, Any]:
        """
        Retrieve the Image-to-3D task object for the given task id.
        Returns the parsed JSON response as a dict.
        """
        url = f"{self.base_url}/openapi/v1/image-to-3d/{task_id}"
        resp = requests.get(url, headers=self._headers(), timeout=30)
        try:
            resp.raise_for_status()
        except requests.HTTPError as e:
            raise RuntimeError(f"Meshy get task failed: {e} - {resp.text}")
        return resp.json()

    def get_glb_link(self, task_id: str, wait: bool = True, timeout: int = 600, poll_interval: int = 5) -> Optional[str]:
        """
        Return the GLB download URL for a Meshy Image-to-3D task.

        If `wait` is True, poll until the task reaches a terminal state or timeout (seconds).
        Returns the GLB URL string on success, or None if not available.
        Raises RuntimeError on API errors or task failure.
        """
        start = time.time()
        while True:
            data = self.get_image_to_3d(task_id)
            status = data.get("status") or data.get("task_status") or ""
            # normalize to uppercase
            status = status.upper() if isinstance(status, str) else status

            # Try to extract glb URL if present
            # Per docs, the GET returns a top-level `model_urls` object. Accept that first,
            # then fall back to `result.model_urls` if present for compatibility.
            model_urls = None
            if isinstance(data, dict):
                model_urls = data.get("model_urls")
                if not model_urls and isinstance(data.get("result"), dict):
                    model_urls = data.get("result", {}).get("model_urls")
            if model_urls:
                glb = model_urls.get("glb") or model_urls.get("model.glb")
                if glb:
                    return glb

            # If not waiting, return None now
            if not wait:
                return None

            # Check for terminal states
            if status in ("SUCCEEDED", "SUCCESS"):
                # if succeeded but no glb found, return None
                return None
            if status in ("FAILED", "ERROR"):
                # include task error message if available
                task_error = data.get("task_error") or {}
                msg = task_error.get("message") if isinstance(task_error, dict) else None
                raise RuntimeError(f"Meshy task failed: {msg or data}")

            # Timeout check
            if time.time() - start > timeout:
                raise TimeoutError(f"Timed out waiting for task {task_id} after {timeout} seconds")

            time.sleep(poll_interval)
