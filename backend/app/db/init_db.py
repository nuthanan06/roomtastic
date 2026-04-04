import app.models  # noqa: F401 — register models with Base.metadata
from app.db.session import get_engine
from app.models.base import Base


def init_db() -> None:
    Base.metadata.create_all(bind=get_engine())
