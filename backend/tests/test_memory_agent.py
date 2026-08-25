"""Unit tests for the Day2 MemoryAgent boundary."""

from __future__ import annotations

import unittest

from agents.memory_agent import MemoryAgent, MemoryPersistenceError
from agents.state import AgentState
from services.memory_service import InMemoryMemoryService, MemoryService


def create_state(intent: str, user_input: str = "我以前压力大的时候怎么调整比较有效？") -> AgentState:
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


class FailingMemoryService(MemoryService):
    def search_memory(self, user_id: str, memory_query: str, top_k: int = 5):
        raise RuntimeError("memory unavailable")

    def save_memory(self, user_id: str, events: list[dict]):
        raise RuntimeError("memory unavailable")

    def update_user_profile(self, user_id: str, user_profile: dict):
        raise RuntimeError("memory unavailable")

    def compress_memory(self, events: list[dict]):
        raise RuntimeError("memory unavailable")


class GuardedState(dict):
    """Raise if MemoryAgent reads fields outside its agreed input boundary."""

    allowed_reads = {"user_id", "user_input", "intent", "extracted_events"}
    allowed_writes = {"retrieved_memories"}

    def __getitem__(self, key):
        if key not in self.allowed_reads:
            raise AssertionError(f"unexpected read from state[{key!r}]")
        return super().__getitem__(key)

    def __setitem__(self, key, value):
        if key not in self.allowed_writes:
            raise AssertionError(f"unexpected write to state[{key!r}]")
        return super().__setitem__(key, value)


class MemoryAgentTest(unittest.TestCase):
    def test_record_event_saves_events_without_retrieval(self) -> None:
        service = InMemoryMemoryService()
        state = create_state("record_event", "今天学习数学2小时")
        state["extracted_events"] = [{"event_content": "学习数学2小时"}]

        result = MemoryAgent(service).process(state)

        self.assertEqual(result["retrieved_memories"], [])
        self.assertEqual(len(service.save_calls), 1)
        self.assertEqual(service.save_calls[0]["user_id"], "user-001")

    def test_query_memory_builds_query_and_retrieves_memories(self) -> None:
        service = InMemoryMemoryService(
            [{"event_content": "散步能缓解压力", "user_id": "user-001"}]
        )
        result = MemoryAgent(service).process(create_state("query_memory"))

        self.assertEqual(len(result["retrieved_memories"]), 1)
        self.assertIn("压力", service.search_calls[0]["memory_query"])

    def test_query_memory_uses_only_contract_fields(self) -> None:
        service = InMemoryMemoryService(
            [{"event_content": "保持睡眠后学习效率更稳定", "user_id": "user-001"}]
        )
        state = GuardedState(
            {
                "user_id": "user-001",
                "user_input": "最近为什么学习效率越来越低？",
                "intent": "query_memory",
                "extracted_events": [],
                "retrieved_memories": [],
                "assistant_response": "must not be read",
                "user_profile": {"must_not": "be read"},
            }
        )

        result = MemoryAgent(service).process(state)

        retrieved_memories = dict.__getitem__(result, "retrieved_memories")
        self.assertEqual(retrieved_memories[0]["event_content"], "保持睡眠后学习效率更稳定")
        self.assertEqual(service.search_calls[0]["user_id"], "user-001")
        self.assertIn("学习效率", service.search_calls[0]["memory_query"])
        self.assertEqual(service.search_calls[0]["top_k"], 5)

    def test_no_retrieval_result_is_valid(self) -> None:
        service = InMemoryMemoryService()
        result = MemoryAgent(service).process(create_state("query_memory"))

        self.assertEqual(result["retrieved_memories"], [])
        self.assertEqual(service.search_calls[0]["top_k"], 5)

    def test_memory_service_exception_degrades_to_empty_result(self) -> None:
        state = create_state("query_memory")

        result = MemoryAgent(FailingMemoryService()).process(state)

        self.assertEqual(result["retrieved_memories"], [])

    def test_record_event_persistence_error_is_not_swallowed(self) -> None:
        state = create_state("record_event")
        state["extracted_events"] = [{"event_content": "study"}]

        with self.assertRaisesRegex(MemoryPersistenceError, "persist"):
            MemoryAgent(FailingMemoryService()).process(state)


if __name__ == "__main__":
    unittest.main()

