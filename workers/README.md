# Workers

This folder contains a simple DB-backed job worker for Roomtastic. It polls the `jobs` table created by the backend CRUD API and processes placeholder AI/layout/chat jobs.

## Run

```bash
cd workers
python3 worker.py
```

Environment variables:

- `DATABASE_URL` (defaults to `sqlite:///./roomtastic.db` from backend config)
- `WORKER_POLL_INTERVAL` (seconds, default `1.0`)

