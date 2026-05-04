# Roomtastic

AI-powered room design platform with a FastAPI backend, Next.js frontend, and a DB-backed worker queue.

## Source Of Truth

Planning artifacts (system design, milestones, architecture notes) live in Figma:

https://www.figma.com/design/NJU5xCb5fPaGaTzim6RJBY/roomtastic-planning?node-id=0-1&p=f&t=GJyrJXiFjtv6f43q-0

## Current Scope

- Hunyuan generation runs through queued jobs (`hunyuan.generate`) and the worker submits/polls RunPod jobs, then persists generated GLBs.
- Legacy depth/scraping flows were removed from active API behavior.

## Tech Stack

- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Three.js/R3F
- Backend: FastAPI, SQLAlchemy, PostgreSQL, Pydantic
- Worker: Python polling worker over `jobs` table

## Architecture

```text
frontend (Next.js)
  -> calls backend REST API

backend (FastAPI)
  -> CRUD/domain routes
  -> jobs enqueue route (/api/jobs/hunyuan/generate)

postgresql
  -> domain tables (users/rooms/furniture/inventory/...)
  -> jobs queue table

workers/worker.py
  -> claims pending jobs with FOR UPDATE SKIP LOCKED
  -> handles hunyuan.generate by submitting/polling RunPod and persisting generated records
```

## Repository Layout

```text
backend/               FastAPI app, models, schemas, controllers, routes
frontend/              Next.js app
workers/               DB-backed background worker
hunyuan-microservice/  RunPod/Hunyuan assets and notes
documentation/         Database + schema references
```

## Backend API Snapshot

Implemented under `/api`:

- Auth
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- Users
  - `GET /api/users/{user_id}`
  - `PATCH /api/users/{user_id}`
  - `DELETE /api/users/{user_id}`
  - `GET /api/users/{user_id}/rooms`
- Rooms
  - `POST /api/rooms`
  - `GET /api/rooms/{room_id}`
  - `PATCH /api/rooms/{room_id}`
  - `DELETE /api/rooms/{room_id}`
  - `GET /api/rooms/{room_id}/shopping-list`
- Furniture
  - `POST /api/rooms/{room_id}/furniture`
  - `GET /api/rooms/{room_id}/furniture`
  - `PATCH /api/furniture/{furniture_id}`
  - `DELETE /api/furniture/{furniture_id}`
  - `PATCH /api/furniture/{furniture_id}/move`
  - `PATCH /api/furniture/{furniture_id}/rotate`
- Lighting
  - `POST /api/rooms/{room_id}/lights`
  - `PATCH /api/lights/{light_id}`
  - `DELETE /api/lights/{light_id}`
- Inventory
  - `GET /api/inventory`
  - `GET /api/inventory/{inventory_id}`
  - `POST /api/inventory`
  - `PATCH /api/inventory/{inventory_id}`
  - `DELETE /api/inventory/{inventory_id}`
- Windows
  - `POST /api/rooms/{room_id}/windows`
  - `GET /api/rooms/{room_id}/windows`
  - `PATCH /api/windows/{window_id}`
  - `DELETE /api/windows/{window_id}`
- Doors
  - `POST /api/rooms/{room_id}/doors`
  - `GET /api/rooms/{room_id}/doors`
  - `PATCH /api/doors/{door_id}`
  - `DELETE /api/doors/{door_id}`
- Jobs
  - `POST /api/jobs/hunyuan/generate`
  - `GET /api/jobs/{job_id}`

## Quick Start

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 main.py
```

### Backend Migrations (Alembic)

Schema is managed by Alembic.
For local development, make sure PostgreSQL is running first (for example `docker compose up -d db` from the repo root).

Apply migrations:

```bash
cd backend
source venv/bin/activate
python -m alembic upgrade head
```

Create a new migration after model changes:

```bash
cd backend
source venv/bin/activate
python -m alembic revision --autogenerate -m "describe_change"
```

Roll back one migration:

```bash
cd backend
source venv/bin/activate
python -m alembic downgrade -1
```

Docker backend startup runs `alembic upgrade head` automatically via
`backend/scripts/docker-start.sh`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Worker

```bash
cd workers
python3 worker.py
```

## Documentation

- Database and model docs: `documentation/database-structure.md`
- Schema reference: `documentation/schema-reference.md`
- Frontend organization guide: `frontend/README.md`
- Frontend architecture notes: `documentation/frontend-architecture.md`

## Notes

- If you change model/schema fields, update files in `documentation/` in the same PR.
