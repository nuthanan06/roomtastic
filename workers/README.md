# Workers

This folder contains a simple DB-backed job worker for Roomtastic. It polls the `jobs` table and processes queued job types.

## Run

```bash
cd workers
python3 worker.py
```

Environment variables:

- `DATABASE_URL` (defaults to `postgresql+psycopg://user:password@localhost:5432/roomtastic` — same as backend. See `backend/app/db/session.py` for default)
- `WORKER_POLL_INTERVAL` (seconds, default `1.0`)

### Note

Current job scope:

1. **`hunyuan.generate`** submits a RunPod job, polls until terminal status, writes the returned GLB to `backend/glb_models`, and creates an `inventory` row with `model_url`.
2. If `room_id` is provided in payload, the worker also creates a linked `furniture` row in that room.

Required environment variables for Hunyuan generation:

- `RUNPOD_ENDPOINT_ID`
- `RUNPOD_API_KEY`

Optional environment variables:

- `RUNPOD_API_BASE` (default `https://api.runpod.ai`)
- `RUNPOD_STATUS_POLL_SECONDS` (default `10`)
- `RUNPOD_MAX_WAIT_SECONDS` (default `1800`)
- `RUNPOD_HTTP_TIMEOUT_SECONDS` (default `120`)
- `HUNYUAN_OUTPUT_DIR` (default `<repo>/backend/glb_models`; relative paths are resolved from the repo root)
- `PUBLIC_BACKEND_URL` (default `http://localhost:8000`)

Web scraping and other placeholder AI/layout job types are not part of the active worker scope.
