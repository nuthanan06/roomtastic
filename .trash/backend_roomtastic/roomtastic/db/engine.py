from __future__ import annotations

from sqlalchemy import create_engine

from roomtastic.core.config import DATABASE_URL


def make_engine():
    connect_args = {}
    if DATABASE_URL.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
    return create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)


engine = make_engine()

