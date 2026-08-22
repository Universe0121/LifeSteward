"""Memory service boundary used by MemoryAgent."""

from __future__ import annotations

from collections.abc import Iterable
from copy import deepcopy
from typing import Any


class MemoryService:
    """Interface between MemoryAgent and persistence/retrieval tools."""

    def search_memory(
        self,
        user_id: str,
        memory_query: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        raise NotImplementedError

    def save_events(self, user_id: str, events: list[dict[str, Any]]) -> None:
        raise NotImplementedError

    def compress_memory(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        raise NotImplementedError


class FakeMemoryService(MemoryService):
    """Deterministic in-memory fake for local development and unit tests."""

    def __init__(self, memories: Iterable[dict[str, Any]] | None = None) -> None:
        self.memories = [deepcopy(item) for item in (memories or [])]
        self.search_calls: list[dict[str, Any]] = []
        self.save_calls: list[dict[str, Any]] = []

    def search_memory(
        self,
        user_id: str,
        memory_query: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        self.search_calls.append(
            {"user_id": user_id, "memory_query": memory_query, "top_k": top_k}
        )
        user_memories = [
            item
            for item in self.memories
            if not item.get("user_id") or item.get("user_id") == user_id
        ]
        query_terms = [
            term
            for term in (
                "今天", "昨天", "最近", "学习", "效率", "睡眠", "睡", "压力",
                "焦虑", "休息", "数学", "英语", "作业", "比赛", "工作", "运动",
                "饮食", "吃饭", "吃", "饭", "代码", "编程", "累", "疲惫", "情绪", "感觉", "状态",
            )
            if term in memory_query
        ]
        if not query_terms:
            return []

        topic_terms = [
            term for term in query_terms
            if term not in ("今天", "昨天", "最近", "状态")
        ]
        if "今天" in query_terms and not topic_terms:
            return deepcopy([
                memory
                for memory in reversed(user_memories)
                if memory.get("user_id") == user_id
            ][:top_k])

        matched_memories = []
        for memory in reversed(user_memories):
            # Do not surface legacy/accidental assistant messages as memories.
            event_content = str(memory.get("event_content", ""))
            if event_content.startswith(("已经帮你记录", "已经记录", "这是我从你的记录中找到")):
                continue
            content = " ".join(
                str(memory.get(field, ""))
                for field in ("event_content", "source_text", "event_type")
            )
            terms = topic_terms or query_terms
            if any(term in content for term in terms):
                matched_memories.append(memory)
        return deepcopy(matched_memories[:top_k])

    def save_events(self, user_id: str, events: list[dict[str, Any]]) -> None:
        copied_events = deepcopy(events)
        self.save_calls.append({"user_id": user_id, "events": copied_events})
        for event in copied_events:
            memory = dict(event)
            content = str(memory.get("event_content", ""))
            if content.startswith(("已经帮你记录", "已经记录", "这是我从你的记录中找到")):
                continue
            memory.setdefault("user_id", user_id)
            self.memories.append(memory)

    def compress_memory(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return deepcopy(events)


class MockMemoryService(FakeMemoryService):
    """Hard-coded mock memories for the Day2 local closed loop."""

    def __init__(self) -> None:
        super().__init__(
            memories=[
                {
                    "user_id": "550e8400-e29b-41d4-a716-446655440000",
                    "event_content": "散步和短暂休息有助于缓解压力",
                    "event_type": "adjustment",
                },
                {
                    "user_id": "550e8400-e29b-41d4-a716-446655440000",
                    "event_content": "睡眠不足时学习效率会下降",
                    "event_type": "sleep",
                },
            ]
        )


InMemoryMemoryService = FakeMemoryService
