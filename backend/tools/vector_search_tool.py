"""Vector search tool for pgvector-backed memory retrieval and persistence."""

from __future__ import annotations

import json
from typing import Any

from core.database import DatabaseClient


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(str(float(value)) for value in values) + "]"


class VectorSearchTool:
    """PostgreSQL pgvector-backed memory operations."""

    def __init__(self, database_client: DatabaseClient | None = None) -> None:
        self._database_client = database_client or DatabaseClient.from_environment()

    def search_memories(
        self,
        user_id: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        if top_k <= 0 or not query_embedding:
            return []

        embedding_literal = _vector_literal(query_embedding)
        rows = self._database_client.fetch_all(
            """
            SELECT
                id AS memory_id,
                user_id,
                memory_type,
                memory_content,
                source_event_id,
                created_at,
                1 - (embedding <=> %s::vector) AS similarity_score
            FROM memories
            WHERE user_id = %s
              AND embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector ASC, id DESC
            LIMIT %s
            """,
            (embedding_literal, str(user_id), embedding_literal, int(top_k)),
        )

        for row in rows:
            similarity_score = row.get("similarity_score")
            if similarity_score is not None:
                row["similarity_score"] = float(similarity_score)
        return rows

    def save_memory(self, memory: dict[str, Any]) -> None:
        user_id = str(memory.get("user_id", "")).strip()
        memory_content = str(memory.get("memory_content", "")).strip()
        if not user_id:
            raise ValueError("memory.user_id is required")
        if not memory_content:
            raise ValueError("memory.memory_content is required")

        embedding = memory.get("embedding")
        source_event_id = memory.get("source_event_id")
        metadata = memory.get("metadata") or {}

        if embedding is not None:
            embedding_sql = "%s::vector"
            params = (
                user_id,
                str(memory.get("memory_type", "habit")).strip() or "habit",
                memory_content,
                _vector_literal(embedding),
                source_event_id,
                json.dumps(metadata, ensure_ascii=False),
            )
        else:
            embedding_sql = "NULL"
            params = (
                user_id,
                str(memory.get("memory_type", "habit")).strip() or "habit",
                memory_content,
                source_event_id,
                json.dumps(metadata, ensure_ascii=False),
            )

        query = f"""
            INSERT INTO memories (
                user_id,
                memory_type,
                memory_content,
                embedding,
                source_event_id,
                metadata
            ) VALUES (
                %s, %s, %s, {embedding_sql}, %s, %s::jsonb
            )
            RETURNING id
            """
        self._database_client.fetch_one(query, params)
