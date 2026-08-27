"""Tests for profile preference persistence and loading."""

import unittest

from agents.profile_agent import ProfileAgent
from agents.state import AgentState
from services.memory_service import FakeMemoryService


def create_state(intent: str, user_input: str) -> AgentState:
    return {
        "user_id": "user-001",
        "conversation_id": "conv-001",
        "user_input": user_input,
        "intent": intent,
        "extracted_events": [],
        "retrieved_memories": [],
        "user_profile": {},
        "current_goal": {},
        "generated_plan": [],
        "reflection_result": {},
        "assistant_response": "",
    }


class ProfileAgentTest(unittest.TestCase):
    def test_update_profile_persists_preferred_programming_language(self) -> None:
        service = FakeMemoryService()
        state = create_state("update_profile", "我以后写代码更喜欢Python")

        ProfileAgent(service).process(state)

        self.assertEqual(state["user_profile"]["preferred_programming_language"], "Python")
        self.assertEqual(service.updated_profiles[0][1]["preferred_programming_language"], "Python")

    def test_query_memory_loads_saved_profile(self) -> None:
        service = FakeMemoryService()
        service.profiles["user-001"] = {"preferred_programming_language": "Python"}
        state = create_state("query_memory", "我编写代码喜欢用什么语言？")

        ProfileAgent(service).process(state)

        self.assertEqual(state["user_profile"]["preferred_programming_language"], "Python")


if __name__ == "__main__":
    unittest.main()
