"""Vector search tool skeleton for memory retrieval and persistence."""

from __future__ import annotations

from typing import Any


class VectorSearchTool:
    """Stub interface for later pgvector-backed memory operations."""

    def search_memories(
        self,
        user_id: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        return []

    def save_memory(self, memory: dict[str, Any]) -> None:
        return None
