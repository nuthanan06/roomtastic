# Roomtastic

An AI-powered spatial design platform that converts 2D images to interactive 3D models.

## Product Planning (Source of Truth)

All planning artifacts (system design, DB schemas, API routes, milestones, and architecture notes) live in Figma:

https://www.figma.com/design/NJU5xCb5fPaGaTzim6RJBY/roomtastic-planning?node-id=0-1&p=f&t=GJyrJXiFjtv6f43q-0

Use that link as the canonical planning reference for ongoing implementation decisions.

## Current Feature: 2D→3D Model Conversion

Convert any 2D image into an interactive 3D visualization using depth estimation:

- **Upload** a 2D image (room, object, landscape)
- **Process** with MiDaS depth estimation
- **Visualize** as rotating 3D model with Three.js
- **Interact** with auto-rotating object

## Tech Stack

- **Frontend**: React + Next.js 16 + Three.js + TypeScript
- **Backend**: Python (FastAPI + SQLAlchemy + PostgreSQL; MiDaS depth scripts)
- **Depth Estimation**: Meta's MiDaS (DPT-Hybrid)
- **3D Rendering**: Three.js with WebGL

## Planned Data Model (DB Schemas)

The project planning board defines these core entities for the room-design workflow:

- **User**: account/profile data and user lifecycle metadata
- **Room**: room ownership, dimensions, and room-level metadata
- **Furniture**: catalog/item metadata for furniture assets
- **LightingFurniture**: lighting-specific furniture attributes (lighting + fixture metadata)
- **Inventory**: available furniture instances and source metadata
- **Position**: object placement coordinates in room space
- **Window**: room window placement and dimensions
- **Door**: room door placement, dimensions, and orientation

> Note: Full field-level schema details are maintained in the Figma planning file above.

## Planned API Schemes / Routes

The API route plan in Figma is organized around CRUD + layout operations for room design.

### Core Resource Routes (Planned)

- `/api/users` and `/api/users/:id`
- `/api/rooms` and `/api/rooms/:id`
- `/api/furniture` and `/api/furniture/:id`
- `/api/inventory` and `/api/inventory/:id`
- `/api/positions` and `/api/positions/:id`
- `/api/windows` and `/api/windows/:id`
- `/api/doors` and `/api/doors/:id`

### Room Composition Routes (Planned)

- Routes to place/update/remove furniture in rooms
- Routes to manage room accessories/openings (doors/windows)
- Routes to retrieve complete room layout state for 3D rendering

### Existing Implemented Backend Routes (Current)

- `/api/process-image`
- `/api/process-3d`
- `/api/tripo`
- `/api/process-url`
- `/api/scrape-ikea`

## Quick Start

### Docker Compose (Postgres + backend + frontend + worker)

From the repo root:

```bash
docker compose up --build
```

- API: `http://localhost:8000` (docs at `/docs`)
- Frontend: `http://localhost:3000`
- Set `DATABASE_URL` if you override defaults (Compose sets `postgresql+psycopg://...` for services).
- **Schema changes**: tables are created on backend startup (`create_all`). If you change models and Postgres already has an older schema, reset the volume: `docker compose down -v` (destructive) or add Alembic migrations.

The worker mounts `./backend` at `/backend` and sets `BACKEND_PATH=/backend` and `DATABASE_URL` so it can import `app` and poll the `jobs` table.

### Backend (local venv)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Ensure PostgreSQL is running and DATABASE_URL is set if not using defaults
python3 main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` and upload an image!

### Optional: Seed Inventory (for AI placeholder suggestions)

```bash
cd backend
source venv/bin/activate
export DATABASE_URL=postgresql+psycopg://roomtastic:roomtastic@localhost:5432/roomtastic
python3 scripts/seed_inventory.py
```

### Workers (processes placeholder AI/layout/chat jobs)

With Postgres available and `DATABASE_URL` pointing at it:

```bash
cd workers
export DATABASE_URL=postgresql+psycopg://roomtastic:roomtastic@localhost:5432/roomtastic
python3 worker.py
```

(`BACKEND_PATH` defaults to `../backend` when run from the repo layout.)

## Architecture

```
Image → MiDaS Depth Est. → Depth Map
           ↓
    Depth + Texture
           ↓
    Three.js PlaneGeometry
           ↓
    Vertex Displacement
           ↓
    Interactive 3D Model
```

## Future Enhancements

- [ ] Model export (GLTF/OBJ)
- [ ] Multiple depth models
- [ ] Post-processing effects
- [ ] Model caching/storage
- [ ] Batch processing
- [ ] Room design tools
- [ ] Furniture integration

## Milestones

Milestones and sprint-level planning are tracked in the same Figma planning board:

https://www.figma.com/design/NJU5xCb5fPaGaTzim6RJBY/roomtastic-planning?node-id=0-1&p=f&t=GJyrJXiFjtv6f43q-0

### Milestone Board Format

The planning board tracks milestones using this structure:

- **Week**
- **Date**
- **Milestone / Phase**
- **Tasks**
- **Deliverables**

### Detailed Milestone Plan

| Week | Dates | Milestone / Goal | Tasks | Deliverables |
| --- | --- | --- | --- | --- |
| Week 1–2 | Early–Mid March | Backend & Database Foundation | Set up database schemas (users, rooms, furniture, inventory, windows/doors, AI layouts); implement REST API routes; set up Next.js API routes or Express + TypeScript backend; start worker setup for scraping Shopify | Functional backend API; DB seeded with test data; worker skeleton ready |
| Week 3 | Mid–March | Frontend Core + Basic Interference | Set up Next.js frontend; integrate TanStack Query for API calls; implement 3D room rendering (React Three Fiber / Three.js); drag & drop furniture placement; implement basic collision detection / interference analysis using bounding boxes; connect frontend to backend APIs | Users can create rooms; place furniture in 3D; real-time updates synced; basic interference detection active |
| Week 4 | Late March | 2D → 3D Research & Prototype | Research libraries/algorithms (OpenCV, Blender Python API, Three.js); experiment generating 3D rooms from 2D floor plans; prototype workflow for integration with frontend; combine 2D→3D with collision / interference logic | Documented workflow for 2D→3D conversion; prototype or demo script working in frontend |
| Week 5 | Early April | Inventory & Worker Integration | Complete scraper for Shopify / other sources; clean & validate scraped products; store inventory in DB; frontend inventory panel with live furniture; furniture placement respects interference detection | Dynamic inventory ready; users can place real products in 3D rooms; collision detection active for inventory items |
| Week 6 | Mid April | AI Layout & Suggestions | Integrate AI service (FastAPI / Python microservice); backend routes for layout generation / optimization / furniture suggestions; frontend UI to request & apply AI layouts; AI uses interference info to suggest feasible placements | Users can apply AI-generated layouts; AI results stored in DB; interference-aware AI suggestions |
| Week 6–7 | Mid–Late April | Polishing & QA | Implement move / rotate / undo for furniture; responsive UI / UX polish; authentication & permissions; logging, error handling, monitoring; deploy backend + frontend | Beta-ready Roomtastic; fully functional 3D room editor; live inventory, AI layouts, collision detection, drag & drop |
| Optional Week 7–8 | Late April | Research / Analytics & Extra Features | Track AI layout performance vs human layouts; visualize inventory usage & room stats; export datasets for research | Research dashboard or dataset ready for experiments; data for future AI improvement |

> For updates to sprint dates, assignees, and task-level acceptance criteria, refer to the Figma milestone table.

## Future: Original Vision

An AI-powered spatial design platform that converts web-scrapped real-world furniture into interactive 3D assets and lets users design rooms using layout tools
