"""Drop and recreate all backend tables from SQLAlchemy models.

WARNING: This is destructive and intended for local/dev only.

Usage:
  cd backend
  RESET_DB_CONFIRM=YES python scripts/reset_db.py
"""

import os

import app.models  # noqa: F401 - ensure models are registered
from app.db.session import get_engine
from app.models.base import Base


CONFIRM_ENV = "RESET_DB_CONFIRM"


def run() -> None:
    if os.getenv(CONFIRM_ENV) != "YES":
        raise SystemExit(
            f"Refusing to run. Set {CONFIRM_ENV}=YES to confirm destructive reset."
        )

    engine = get_engine()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database reset complete (drop_all + create_all).")


if __name__ == "__main__":
    run()
