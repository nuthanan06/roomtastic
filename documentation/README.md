# Roomtastic Documentation

This folder contains backend data model documentation for the current FastAPI + SQLAlchemy implementation.

## Contents

- `database-structure.md`: Database engine setup, table list, relationships, and migration notes.
- `schema-reference.md`: Pydantic request/response schemas used by API routes.

## Source of Truth

The docs are based on the current code under:

- `backend/app/models`
- `backend/app/schemas`
- `backend/app/db/session.py`
- `backend/app/db/init_db.py`

If you update models or schemas, update these docs in the same PR.
