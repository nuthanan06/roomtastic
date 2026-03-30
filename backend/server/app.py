"""
Legacy entrypoint: use `uvicorn app.main:app` (see backend/main.py and Dockerfile).
This module is kept for backwards compatibility only.
"""

from app.main import app

__all__ = ["app"]
