from typing import Optional

from pydantic import BaseModel, model_validator


class HunyuanGenerateOptions(BaseModel):
    image_base64: Optional[str] = None
    image_url: Optional[str] = None
    image_mime: Optional[str] = None
    quality: Optional[str] = "standard"
    include_texture: bool = True
    num_inference_steps: int = 50
    octree_resolution: int = 384
    seed: Optional[int] = 1234
    guidance_scale: float = 7.5
    num_chunks: int = 200000
    face_count: int = 80000

    @model_validator(mode="after")
    def validate_image_source(self):
        if not (self.image_base64 or self.image_url):
            raise ValueError("Either image_base64 or image_url is required")
        return self
