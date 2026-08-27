"""Delete explicitly named demo/test conversation batches."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.database import DatabaseClient
from tools.sql_tool import SQLTool


def clean_demo_data(user_id: str, conversation_ids: list[str]) -> int:
    normalized = [value.strip() for value in conversation_ids if value.strip()]
    if not normalized:
        raise ValueError("at least one conversation_id is required")
    tool = SQLTool(DatabaseClient.from_environment())
    for conversation_id in normalized:
        tool.delete_simulation_batch(user_id, conversation_id)
    return len(normalized)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", default="10001")
    parser.add_argument("--conversation-id", action="append", required=True)
    args = parser.parse_args()
    count = clean_demo_data(args.user_id, args.conversation_id)
    print(f"deleted {count} explicitly selected demo batch(es)")


if __name__ == "__main__":
    main()
