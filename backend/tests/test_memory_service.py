"""Tests for MemoryService Tool orchestration."""

import unittest

from core.llm_service import CallableLLMService
from services.memory_service import ToolMemoryService


class FakeSQLTool:
    def __init__(self) -> None:
        self.saved_events = []
        self.updated_profiles = []
        self.profile = {}

    def save_life_events(self, events):
        self.saved_events = list(events)
        return len(self.saved_events)

    def update_user_profile(self, user_id, profile_data):
        self.updated_profiles.append((user_id, profile_data))

    def get_user_profile(self, user_id):
        return dict(self.profile)


class FakeVectorSearchTool:
    def __init__(self) -> None:
        self.search_call = None
        self.saved_memories = []

    def search_memories(self, user_id, query_embedding, top_k=5):
        self.search_call = (user_id, query_embedding, top_k)
        return [{"memory_content": "睡眠不足会影响效率"}]

    def save_memory(self, memory):
        self.saved_memories.append(memory)


class MemoryServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.sql_tool = FakeSQLTool()
        self.vector_tool = FakeVectorSearchTool()
        self.llm = CallableLLMService(lambda prompt, variables: "", lambda text: [0.1, 0.2])
        self.service = ToolMemoryService(self.sql_tool, self.vector_tool, self.llm)

    def test_search_memory_embeds_query_and_passes_user_id(self) -> None:
        result = self.service.search_memory("user-001", "最近学习效率", top_k=3)
        self.assertEqual(result[0]["memory_content"], "睡眠不足会影响效率")
        self.assertEqual(self.vector_tool.search_call, ("user-001", [0.1, 0.2], 3))

    def test_empty_search_does_not_call_tool(self) -> None:
        self.assertEqual(self.service.search_memory("user-001", "  "), [])
        self.assertIsNone(self.vector_tool.search_call)

    def test_save_memory_writes_sql_and_vector_tools(self) -> None:
        self.service.save_memory("user-001", [{"event_type": "sleep", "event_content": "只睡了4小时"}])
        self.assertEqual(self.sql_tool.saved_events[0]["user_id"], "user-001")
        self.assertEqual(self.vector_tool.saved_memories[0]["embedding"], [0.1, 0.2])

    def test_update_user_profile_delegates_to_sql_tool(self) -> None:
        profile = {"sleep_target_hours": 8}
        self.service.update_user_profile("user-001", profile)
        self.assertEqual(self.sql_tool.updated_profiles, [("user-001", profile)])

    def test_get_user_profile_delegates_to_sql_tool(self) -> None:
        self.sql_tool.profile = {"preferred_language": "Python"}

        self.assertEqual(
            self.service.get_user_profile("user-001"),
            {"preferred_language": "Python"},
        )

    def test_tool_exception_is_propagated_to_agent_boundary(self) -> None:
        self.vector_tool.search_memories = lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("db unavailable"))
        with self.assertRaisesRegex(RuntimeError, "db unavailable"):
            self.service.search_memory("user-001", "学习")


if __name__ == "__main__":
    unittest.main()
