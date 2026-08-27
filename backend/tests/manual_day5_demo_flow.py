"""Manual Day5 web-demo verification against real services.

Run this only after configuring backend/.env and starting the backend:

    cd D:\Codex\黑客松\backend
    python -m uvicorn main:app --reload

Then in another terminal:

    cd D:\Codex\黑客松\backend
    python tests\manual_day5_demo_flow.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from urllib import error, request

from dotenv import load_dotenv

from core.database import DatabaseClient
from core.llm_service import create_llm_service_from_environment
from tools.vector_search_tool import VectorSearchTool


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEMO_USER_ID = "10001"
DEMO_CONVERSATION_ID = "day5_demo_10001"
DEMO_MESSAGES = [
    "最近三天每天只睡5小时。",
    "最近学习效率很差。",
    "压力比较大。",
]


def post_chat(api_base: str, user_input: str) -> dict:
    payload = {
        "user_id": int(DEMO_USER_ID),
        "conversation_id": DEMO_CONVERSATION_ID,
        "user_input": user_input,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    chat_request = request.Request(
        f"{api_base.rstrip('/')}/api/v1/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(chat_request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"chat request failed: {exc.code} {detail}") from exc


def main() -> None:
    load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)

    api_base = os.getenv("LIFE_STEWARD_API_BASE", "http://127.0.0.1:8000")
    database_client = DatabaseClient.from_environment()
    vector_tool = VectorSearchTool(database_client)
    llm_service = create_llm_service_from_environment()

    print(f"Posting Day5 demo records to {api_base} for user_id={DEMO_USER_ID}")
    for message in DEMO_MESSAGES:
        response = post_chat(api_base, message)
        print(
            json.dumps(
                {
                    "user_input": message,
                    "intent": response.get("intent"),
                    "extracted_events_count": len(response.get("extracted_events", [])),
                },
                ensure_ascii=False,
            )
        )

    life_events = database_client.fetch_all(
        """
        SELECT
            id AS life_event_id,
            event_type,
            event_content,
            event_time,
            emotion,
            importance_score
        FROM life_events
        WHERE user_id = %s
          AND conversation_id = %s
        ORDER BY id ASC
        """,
        (DEMO_USER_ID, DEMO_CONVERSATION_ID),
    )
    if len(life_events) < len(DEMO_MESSAGES):
        raise RuntimeError(
            f"expected at least {len(DEMO_MESSAGES)} life_events, got {len(life_events)}"
        )

    memory_row = database_client.fetch_one(
        """
        SELECT COUNT(*) AS memory_count
        FROM memories
        WHERE user_id = %s
          AND embedding IS NOT NULL
        """,
        (DEMO_USER_ID,),
    )
    if not memory_row or int(memory_row["memory_count"]) < 1:
        raise RuntimeError("expected at least one memory with a non-null embedding")

    query_embedding = llm_service.embed_text("最近为什么学习效率下降？")
    memories = vector_tool.search_memories(DEMO_USER_ID, query_embedding, top_k=3)
    if not memories:
        raise RuntimeError("expected pgvector search to return at least one memory")

    print(
        json.dumps(
            {
                "life_events_count": len(life_events),
                "memory_count": int(memory_row["memory_count"]),
                "embedding_dimension": len(query_embedding),
                "top_memory": {
                    "memory_id": memories[0].get("memory_id"),
                    "memory_content": memories[0].get("memory_content"),
                    "similarity_score": memories[0].get("similarity_score"),
                },
            },
            ensure_ascii=False,
            default=str,
        )
    )


if __name__ == "__main__":
    main()
