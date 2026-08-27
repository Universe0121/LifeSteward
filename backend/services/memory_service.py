"""Memory service boundary used by MemoryAgent."""

from __future__ import annotations

from collections.abc import Iterable
from copy import deepcopy
from typing import Any

from core.llm_service import LLMService
from tools.sql_tool import SQLTool
from tools.vector_search_tool import VectorSearchTool


class MemoryService:
    """Interface between MemoryAgent and persistence/retrieval tools."""

    def search_memory(
        self,
        user_id: str,
        memory_query: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        raise NotImplementedError

    def save_memory(self, user_id: str, events: list[dict[str, Any]]) -> None:
        raise NotImplementedError

    def update_user_profile(self, user_id: str, user_profile: dict[str, Any]) -> None:
        raise NotImplementedError

    def get_user_profile(self, user_id: str) -> dict[str, Any]:
        raise NotImplementedError

    def compress_memory(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        raise NotImplementedError


class ToolMemoryService(MemoryService):
    """Production memory orchestration over the agreed Tool boundaries."""

    def __init__(self, sql_tool: SQLTool, vector_search_tool: VectorSearchTool, llm_service: LLMService) -> None:
        self._sql_tool = sql_tool
        self._vector_search_tool = vector_search_tool
        self._llm_service = llm_service

    def search_memory(self, user_id: str, memory_query: str, top_k: int = 5) -> list[dict[str, Any]]:
        if not memory_query.strip():
            return []
        query_embedding = self._llm_service.embed_text(memory_query)
        if not query_embedding:
            return []
        return self._vector_search_tool.search_memories(user_id, query_embedding, top_k)

    def save_memory(self, user_id: str, events: list[dict[str, Any]]) -> None:
        normalized_events = []
        for event in events:
            normalized_event = deepcopy(event)
            normalized_event.setdefault("user_id", user_id)
            normalized_events.append(normalized_event)
        if not normalized_events:
            return
        self._sql_tool.save_life_events(normalized_events)
        for event in normalized_events:
            memory_content = str(event.get("memory_content") or event.get("event_content") or "").strip()
            if not memory_content:
                continue
            new_memory = {
                "user_id": user_id,
                "memory_type": event.get("event_type", "life_event"),
                "memory_content": memory_content,
                "embedding": self._llm_service.embed_text(memory_content),
                "source_event": event,
            }
            self._vector_search_tool.save_memory(new_memory)

    def update_user_profile(self, user_id: str, user_profile: dict[str, Any]) -> None:
        self._sql_tool.update_user_profile(user_id, user_profile)

    def get_user_profile(self, user_id: str) -> dict[str, Any]:
        return self._sql_tool.get_user_profile(user_id)

    def compress_memory(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return deepcopy(events)


class FakeMemoryService(MemoryService):
    """Deterministic in-memory fake for local development and unit tests."""

    def __init__(self, memories: Iterable[dict[str, Any]] | None = None) -> None:
        self.memories = [deepcopy(item) for item in (memories or [])]
        self.search_calls: list[dict[str, Any]] = []
        self.save_calls: list[dict[str, Any]] = []
        self.profiles: dict[str, dict[str, Any]] = {}
        self.updated_profiles: list[tuple[str, dict[str, Any]]] = []

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

    def save_memory(self, user_id: str, events: list[dict[str, Any]]) -> None:
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

    def update_user_profile(self, user_id: str, user_profile: dict[str, Any]) -> None:
        self.profiles[str(user_id)] = deepcopy(user_profile)
        self.updated_profiles.append((str(user_id), deepcopy(user_profile)))

    def get_user_profile(self, user_id: str) -> dict[str, Any]:
        return deepcopy(self.profiles.get(str(user_id), {}))


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
