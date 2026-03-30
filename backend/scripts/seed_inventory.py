from __future__ import annotations

import os
import sys
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.db.init_db import init_db
from app.models.inventory import Inventory
from app.db.session import session_scope


def main():
    init_db()
    now = datetime.utcnow()
    items = [
        Inventory(
            name="Modern Sofa",
            category="Seating",
            width=220,
            length=90,
            height=85,
            price="$799",
            description="Placeholder sofa",
            url_link="https://example.com/sofa",
            thumbnail_url=None,
            model_url=None,
            source="seed",
            source_id="seed-sofa",
            created_at=now,
            updated_at=now,
        ),
        Inventory(
            name="Oak Coffee Table",
            category="Tables",
            width=120,
            length=60,
            height=45,
            price="$199",
            description="Placeholder coffee table",
            url_link="https://example.com/coffee-table",
            source="seed",
            source_id="seed-table",
            created_at=now,
            updated_at=now,
        ),
        Inventory(
            name="Floor Lamp",
            category="Lighting",
            width=40,
            length=40,
            height=160,
            price="$89",
            description="Placeholder lamp",
            url_link="https://example.com/lamp",
            source="seed",
            source_id="seed-lamp",
            created_at=now,
            updated_at=now,
        ),
    ]
    with session_scope() as s:
        for i in items:
            s.add(i)
    print("Seeded inventory:", len(items))


if __name__ == "__main__":
    main()

