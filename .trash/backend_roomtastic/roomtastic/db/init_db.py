from __future__ import annotations

from roomtastic.db.base import Base
from roomtastic.db.engine import engine


def init_db() -> None:
    # For initial implementation, we create tables on startup.
    # Later: switch to Alembic migrations.
    Base.metadata.create_all(bind=engine)

