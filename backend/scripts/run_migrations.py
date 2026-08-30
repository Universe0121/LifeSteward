"""Apply the checked-in PostgreSQL migrations in a repeatable order."""

from __future__ import annotations

import os
from pathlib import Path
import sys

from dotenv import load_dotenv

# Support both `python -m scripts.run_migrations` and the documented
# `python scripts/run_migrations.py` invocation from the backend directory.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.database import DatabaseClient


MIGRATION_PATHS = (
    BACKEND_DIR / "migrations" / "001_initial_memory_schema.sql",
    BACKEND_DIR / "migrations" / "002_weekly_reports.sql",
)


def apply_migrations(postgres_dsn: str | None = None) -> list[str]:
    """Apply all migrations and return their filenames."""

    load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)
    dsn = (postgres_dsn or os.getenv("POSTGRES_DSN", "")).strip()
    if not dsn:
        raise RuntimeError("POSTGRES_DSN is not configured")

    client = DatabaseClient(dsn)
    applied: list[str] = []
    for migration_path in MIGRATION_PATHS:
        client.execute_script(migration_path.read_text(encoding="utf-8"))
        applied.append(migration_path.name)
    return applied


if __name__ == "__main__":
    for name in apply_migrations():
        print(f"migration_applied={name}")
