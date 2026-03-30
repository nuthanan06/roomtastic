from contextlib import contextmanager
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://roomtastic:roomtastic@localhost:5432/roomtastic",
)

_engine = None
_SessionLocal = None


def get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_engine(DATABASE_URL)
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def _session_factory():
    get_engine()
    assert _SessionLocal is not None
    return _SessionLocal


def get_db():
    db = _session_factory()()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope():
    session = _session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# Backwards compatibility: `engine` resolves lazily for init_db
class _EngineProxy:
    def __getattr__(self, name):
        return getattr(get_engine(), name)


engine = _EngineProxy()


class _SessionLocalProxy:
    def __call__(self, *args, **kwargs):
        return _session_factory()(*args, **kwargs)


SessionLocal = _SessionLocalProxy()
