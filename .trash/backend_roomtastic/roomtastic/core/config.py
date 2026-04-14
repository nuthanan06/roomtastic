from __future__ import annotations

import os


_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_DEFAULT_SQLITE_PATH = os.path.join(_BACKEND_DIR, "roomtastic.db")


def env(key: str, default: str | None = None) -> str | None:
    v = os.environ.get(key)
    if v is None or v == "":
        return default
    return v


DATABASE_URL = env("DATABASE_URL", f"sqlite:///{_DEFAULT_SQLITE_PATH}")
AUTH_SECRET = env("AUTH_SECRET", "dev-secret-change-me")
AUTH_TOKEN_TTL_SECONDS = int(env("AUTH_TOKEN_TTL_SECONDS", "604800"))  # 7 days
