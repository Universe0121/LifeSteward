"""Tests for the pgvector memory search tool."""

from __future__ import annotations

import unittest
from dataclasses import dataclass, field
from typing import Any

from tools.vector_search_tool import VectorSearchTool


@dataclass
class FakeDatabaseClient:
    fetch_all_result: list[dict[str, Any]] = field(default_factory=list)
    fetch_one_result: dict[str, Any] | None = None
    fetch_all_calls: list[tuple[str, tuple[Any, ...]]] = field(default_factory=list)
    fetch_one_calls: list[tuple[str, tuple[Any, ...]]] = field(default_factory=list)

    def fetch_all(
        self,
        query: str,
        params: tuple[Any, ...] | list[Any] | None = None,
    ) -> list[dict[str, Any]]:
        self.fetch_all_calls.append((query, tuple(params or ())))
        return list(self.fetch_all_result)

    def fetch_one(
        self,
        query: str,
        params: tuple[Any, ...] | list[Any] | None = None,
    ) -> dict[str, Any] | None:
        self.fetch_one_calls.append((query, tuple(params or ())))
        return self.fetch_one_result


class VectorSearchToolTestCase(unittest.TestCase):
    def test_search_memories_returns_similarity_scores(self) -> None:
        client = FakeDatabaseClient(
            fetch_all_result=[
                {
                    "memory_id": 1,
                    "user_id": "10001",
                    "memory_type": "habit",
                    "memory_content": "用户晚上学习效率较低",
                    "similarity_score": 0.86,
                }
            ]
        )
        tool = VectorSearchTool(database_client=client)

        memories = tool.search_memories("10001", [0.1, 0.2, 0.3], top_k=5)

        self.assertEqual(len(memories), 1)
        self.assertEqual(memories[0]["memory_id"], 1)
        self.assertEqual(memories[0]["similarity_score"], 0.86)
        self.assertEqual(client.fetch_all_calls[0][1][1], "10001")
        self.assertEqual(client.fetch_all_calls[0][1][3], 5)

    def test_search_memories_returns_empty_for_non_positive_top_k(self) -> None:
        tool = VectorSearchTool(database_client=FakeDatabaseClient())

        self.assertEqual(tool.search_memories("10001", [0.1, 0.2], top_k=0), [])

    def test_save_memory_uses_embedding_and_metadata(self) -> None:
        client = FakeDatabaseClient(fetch_one_result={"id": 1})
        tool = VectorSearchTool(database_client=client)

        tool.save_memory(
            {
                "user_id": "10001",
                "memory_type": "habit",
                "memory_content": "用户晚上学习效率较低",
                "embedding": [0.1, 0.2, 0.3],
                "metadata": {"source": "reflection"},
            }
        )

        self.assertEqual(len(client.fetch_one_calls), 1)
        self.assertEqual(client.fetch_one_calls[0][1][0], "10001")
        self.assertEqual(client.fetch_one_calls[0][1][1], "habit")
        self.assertEqual(client.fetch_one_calls[0][1][2], "用户晚上学习效率较低")
        self.assertEqual(client.fetch_one_calls[0][1][3], "[0.1,0.2,0.3]")

    def test_save_memory_rejects_missing_content(self) -> None:
        tool = VectorSearchTool(database_client=FakeDatabaseClient())

        with self.assertRaises(ValueError):
            tool.save_memory({"user_id": "10001"})

    def test_pgvector_error_is_visible_to_caller(self) -> None:
        class BrokenDatabaseClient(FakeDatabaseClient):
            def fetch_all(self, query, params=None):
                raise RuntimeError("pgvector unavailable")

        tool = VectorSearchTool(database_client=BrokenDatabaseClient())

        with self.assertRaisesRegex(RuntimeError, "pgvector unavailable"):
            tool.search_memories("10001", [0.1, 0.2])


if __name__ == "__main__":
    unittest.main()
