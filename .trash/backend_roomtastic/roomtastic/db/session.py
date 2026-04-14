from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy.orm import Session, sessionmaker

from roomtastic.db.engine import engine


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@contextmanager
def session_scope():
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session():
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

