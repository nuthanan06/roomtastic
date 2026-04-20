"""Idempotent schema upgrades for existing DBs when not using Alembic.

Usage:
  cd backend
  python scripts/apply_schema_updates.py
"""

from sqlalchemy import text

from app.db.session import get_engine


def run() -> None:
    engine = get_engine()
    with engine.begin() as conn:
        # Tags on inventory/furniture
        conn.execute(
            text(
                """
                ALTER TABLE inventory
                ADD COLUMN IF NOT EXISTS tags JSON NOT NULL DEFAULT '[]'::json;
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE furniture
                ADD COLUMN IF NOT EXISTS tags JSON NOT NULL DEFAULT '[]'::json;
                """
            )
        )

        # Unified openings table.
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS openings (
                    opening_id UUID PRIMARY KEY,
                    room_id UUID NOT NULL REFERENCES rooms(room_id),
                    kind VARCHAR NOT NULL,
                    wall VARCHAR NOT NULL,
                    t DOUBLE PRECISION NOT NULL,
                    width_m DOUBLE PRECISION NOT NULL,
                    height_m DOUBLE PRECISION NOT NULL,
                    sill_m DOUBLE PRECISION NOT NULL DEFAULT 0.0
                );
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_openings_room_id ON openings(room_id);
                """
            )
        )

        # Ensure old tables have migration columns if they still exist.
        conn.execute(text("ALTER TABLE IF EXISTS doors ADD COLUMN IF NOT EXISTS wall VARCHAR;"))
        conn.execute(text("ALTER TABLE IF EXISTS doors ADD COLUMN IF NOT EXISTS t DOUBLE PRECISION;"))
        conn.execute(text("ALTER TABLE IF EXISTS doors ADD COLUMN IF NOT EXISTS width_m DOUBLE PRECISION;"))
        conn.execute(text("ALTER TABLE IF EXISTS doors ADD COLUMN IF NOT EXISTS height_m DOUBLE PRECISION;"))
        conn.execute(text("ALTER TABLE IF EXISTS doors ADD COLUMN IF NOT EXISTS sill_m DOUBLE PRECISION;"))
        conn.execute(text("ALTER TABLE IF EXISTS windows ADD COLUMN IF NOT EXISTS wall VARCHAR;"))
        conn.execute(text("ALTER TABLE IF EXISTS windows ADD COLUMN IF NOT EXISTS t DOUBLE PRECISION;"))
        conn.execute(text("ALTER TABLE IF EXISTS windows ADD COLUMN IF NOT EXISTS width_m DOUBLE PRECISION;"))
        conn.execute(text("ALTER TABLE IF EXISTS windows ADD COLUMN IF NOT EXISTS height_m DOUBLE PRECISION;"))
        conn.execute(text("ALTER TABLE IF EXISTS windows ADD COLUMN IF NOT EXISTS sill_m DOUBLE PRECISION;"))

        # Backfill into unified openings from legacy doors/windows when present.
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF to_regclass('public.doors') IS NOT NULL THEN
                        UPDATE doors
                        SET width_m = width / 100.0
                        WHERE width_m IS NULL AND width IS NOT NULL;

                        UPDATE doors
                        SET height_m = height / 100.0
                        WHERE height_m IS NULL AND height IS NOT NULL;

                        UPDATE doors
                        SET sill_m = 0.0
                        WHERE sill_m IS NULL;

                        INSERT INTO openings (opening_id, room_id, kind, wall, t, width_m, height_m, sill_m)
                        SELECT
                            door_id,
                            room_id,
                            'door',
                            COALESCE(NULLIF(wall, ''), 'pz'),
                            COALESCE(t, 0.5),
                            COALESCE(width_m, 0.9),
                            COALESCE(height_m, 2.0),
                            COALESCE(sill_m, 0.0)
                        FROM doors d
                        WHERE NOT EXISTS (
                            SELECT 1 FROM openings o WHERE o.opening_id = d.door_id
                        );
                    END IF;

                    IF to_regclass('public.windows') IS NOT NULL THEN
                        UPDATE windows
                        SET width_m = width / 100.0
                        WHERE width_m IS NULL AND width IS NOT NULL;

                        UPDATE windows
                        SET height_m = height / 100.0
                        WHERE height_m IS NULL AND height IS NOT NULL;

                        UPDATE windows
                        SET sill_m = sill_height / 100.0
                        WHERE sill_m IS NULL AND sill_height IS NOT NULL;

                        INSERT INTO openings (opening_id, room_id, kind, wall, t, width_m, height_m, sill_m)
                        SELECT
                            window_id,
                            room_id,
                            'window',
                            COALESCE(NULLIF(wall, ''), 'pz'),
                            COALESCE(t, 0.5),
                            COALESCE(width_m, 1.2),
                            COALESCE(height_m, 1.0),
                            COALESCE(sill_m, 1.0)
                        FROM windows w
                        WHERE NOT EXISTS (
                            SELECT 1 FROM openings o WHERE o.opening_id = w.window_id
                        );
                    END IF;
                END $$;
                """
            )
        )

    print("Schema updates applied successfully.")


if __name__ == "__main__":
    run()
