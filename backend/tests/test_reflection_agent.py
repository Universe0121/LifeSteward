"""Tests for ReflectionAgent state boundaries and fallback behavior."""

import json
import unittest

from agents.reflection_agent import ReflectionAgent
from core.llm_service import CallableLLMService
from tests.test_memory_agent import create_state


class GuardedReflectionState(dict):
    allowed_reads = {"user_input", "retrieved_memories", "user_profile", "extracted_events"}

    def __getitem__(self, key):
        if key not in self.allowed_reads:
            raise AssertionError(f"unexpected read: {key}")
        return super().__getitem__(key)

    def __setitem__(self, key, value):
        if key != "reflection_result":
            raise AssertionError(f"unexpected write: {key}")
        return super().__setitem__(key, value)


class ReflectionAgentTest(unittest.TestCase):
    def test_generates_structured_reflection_from_memories(self) -> None:
        response = json.dumps({"status": "high_pressure", "problem": "计划过重", "suggestion": "减少任务量并恢复睡眠"})
        state = create_state("reflection", "最近为什么效率下降？")
        state["retrieved_memories"] = [{"memory_content": "连续三天只睡4小时"}]
        result = ReflectionAgent(CallableLLMService(lambda prompt, variables: response)).process(state)
        self.assertEqual(result["reflection_result"]["problem"], "计划过重")

    def test_no_memories_degrades_without_llm_call(self) -> None:
        called = []
        state = create_state("reflection")
        result = ReflectionAgent(CallableLLMService(lambda prompt, variables: called.append(True))).process(state)
        self.assertEqual(result["reflection_result"]["status"], "insufficient_data")
        self.assertEqual(called, [])

    def test_only_reads_contract_fields_and_writes_reflection_result(self) -> None:
        response = json.dumps({"status": "stable", "problem": "节奏波动", "suggestion": "保持记录"})
        state = GuardedReflectionState({
            "user_input": "复盘", "retrieved_memories": [{"memory_content": "记录"}],
            "user_profile": {}, "extracted_events": [], "reflection_result": {},
            "assistant_response": "unchanged", "generated_plan": [],
        })
        result = ReflectionAgent(CallableLLMService(lambda prompt, variables: response)).process(state)
        self.assertEqual(dict.__getitem__(result, "assistant_response"), "unchanged")

    def test_llm_exception_degrades_safely(self) -> None:
        state = create_state("reflection")
        state["retrieved_memories"] = [{"memory_content": "记录"}]
        result = ReflectionAgent(CallableLLMService(lambda prompt, variables: (_ for _ in ()).throw(RuntimeError("failed")))).process(state)
        self.assertEqual(result["reflection_result"]["status"], "insufficient_data")


if __name__ == "__main__":
    unittest.main()
