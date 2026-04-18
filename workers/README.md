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

1. **`hunyuan.generate`** job type is recognized by the worker.
2. Execution intentionally fails with a clear "not implemented" error until RunPod/Hunyuan integration is added.

Web scraping and other placeholder AI/layout job types are not part of the active worker scope.

