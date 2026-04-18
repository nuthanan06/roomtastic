# Database Structure

## Engine and Session

- Database URL is configured in `backend/app/db/session.py`.
- Default connection:
  - `postgresql+psycopg://roomtastic:roomtastic@localhost:5432/roomtastic`
- `get_engine()` initializes SQLAlchemy engine lazily.
- `get_db()` yields request-scoped DB sessions for FastAPI dependencies.
- `session_scope()` provides transaction-scoped context manager for worker/background logic.

## Table Initialization

- `backend/app/db/init_db.py` imports `app.models` and calls:
  - `Base.metadata.create_all(bind=get_engine())`
- This creates tables for all models exported by `backend/app/models/__init__.py`.

## Tables

### users
Defined in `backend/app/models/user.py`

Columns:
- `user_id` (UUID, PK)
- `first_name` (String, required)
- `last_name` (String, required)
- `email` (String, required, unique, indexed)
- `password_hash` (Text, nullable)
- `account_created` (DateTime, nullable)
- `last_logged_in` (DateTime, nullable)

Relationships:
- one-to-many with `rooms` via `rooms.user_id`

### rooms
Defined in `backend/app/models/room.py`

Columns:
- `room_id` (UUID, PK)
- `user_id` (UUID, FK -> users.user_id)
- `wall_colour` (String)
- `is_natural_light` (Boolean, default false)
- `width` (Integer)
- `length` (Integer)
- `height` (Integer)
- `last_edited` (DateTime)

Relationships:
- many-to-one to `users`
- one-to-many to `furniture`
- one-to-many to `windows`
- one-to-many to `doors`

### positions
Defined in `backend/app/models/position.py`

Columns:
- `id` (Integer, PK, autoincrement)
- `x` (Integer)
- `y` (Integer)
- `z` (Integer)

Used by:
- `doors.position_id`
- `windows.position_id`

### inventory
Defined in `backend/app/models/inventory.py`

Columns:
- `inventory_id` (UUID, PK)
- `name` (String)
- `category` (String)
- `width` (Integer)
- `length` (Integer)
- `height` (Integer)
- `model_url` (String)
- `thumbnail_url` (String)
- `colour_options` (String)
- `price` (String)
- `description` (String)
- `url_link` (String)
- `source` (String, nullable)
- `source_id` (String, nullable)
- `created_at` (DateTime, required)
- `updated_at` (DateTime, required)

Relationships:
- one-to-many with `furniture` via `furniture.inventory_id`

### furniture
Defined in `backend/app/models/furniture.py`

Columns:
- `furniture_id` (UUID, PK)
- `room_id` (UUID, FK -> rooms.room_id)
- `inventory_id` (UUID, FK -> inventory.inventory_id)
- `name_of_furniture` (String)
- `coordinates` (String; JSON serialized text)
- `rotation` (Integer)
- `width` (Integer)
- `height` (Integer)
- `created_at` (DateTime, required)
- `updated_at` (DateTime, required)

Relationships:
- many-to-one to `rooms`
- many-to-one to `inventory`
- one-to-one to `lighting_furniture` via unique FK on lighting table

### lighting_furniture
Defined in `backend/app/models/lighting_furniture.py`

Columns:
- `id` (UUID, PK)
- `furniture_id` (UUID, FK -> furniture.furniture_id, unique)
- `type` (String)
- `intensity` (Float)
- `color_temperature` (Integer)

Relationships:
- one-to-one to `furniture`

### windows
Defined in `backend/app/models/window.py`

Columns:
- `window_id` (UUID, PK)
- `room_id` (UUID, FK -> rooms.room_id)
- `position_id` (Integer, FK -> positions.id)
- `width` (Integer)
- `height` (Integer)
- `sill_height` (Integer)

Relationships:
- many-to-one to `rooms`
- many-to-one to `positions`

### doors
Defined in `backend/app/models/door.py`

Columns:
- `door_id` (UUID, PK)
- `room_id` (UUID, FK -> rooms.room_id)
- `position_id` (Integer, FK -> positions.id)
- `width` (Integer)
- `height` (Integer)
- `rotation` (Integer)
- `swing_direction` (String)

Relationships:
- many-to-one to `rooms`
- many-to-one to `positions`

### jobs
Defined in `backend/app/models/job.py`

Columns:
- `job_id` (UUID, PK)
- `type` (String(100), indexed)
- `status` (Enum: pending|running|succeeded|failed, indexed)
- `payload` (JSON, required)
- `result` (JSON, nullable)
- `error` (Text, nullable)
- `attempts` (Integer, required)
- `created_at` (DateTime, required)
- `started_at` (DateTime, nullable)
- `finished_at` (DateTime, nullable)
- `updated_at` (DateTime, required)

Current job type in active use:
- `hunyuan.generate` (skeleton flow)

## Relationship Diagram (Text)

- users 1 -> many rooms
- rooms 1 -> many furniture
- rooms 1 -> many windows
- rooms 1 -> many doors
- positions 1 -> many windows
- positions 1 -> many doors
- inventory 1 -> many furniture
- furniture 1 -> 1 lighting_furniture
- jobs is standalone queue table

## Notes

- UUID PKs are used for most domain entities; `positions` uses integer PK.
- `coordinates` in `furniture` is stored as text, not JSONB.
- Schema/table migrations currently rely on `create_all`, not Alembic migrations.
