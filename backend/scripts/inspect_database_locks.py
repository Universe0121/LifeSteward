"""Print PostgreSQL sessions and blocking relationships for diagnostics."""

from __future__ import annotations

import json
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from core.database import DatabaseClient


def main() -> None:
    rows = DatabaseClient.from_environment().fetch_all(
        """
        SELECT
            pid,
            usename,
            application_name,
            state,
            wait_event_type,
            wait_event,
            pg_blocking_pids(pid) AS blocked_by,
            now() - xact_start AS transaction_age,
            now() - query_start AS query_age,
            left(query, 240) AS query
        FROM pg_stat_activity
        WHERE datname = current_database()
        ORDER BY query_start
        """
    )
    print(json.dumps(rows, indent=2, default=str))


if __name__ == "__main__":
    main()
