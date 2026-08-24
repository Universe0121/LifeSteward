import json
import unittest

from agents.planning_agent import PlanningAgent
from agents.state import AgentState
from core.llm_service import CallableLLMService


def state() -> AgentState:
    return {"user_id":"u","conversation_id":"c","user_input":"制定计划","intent":"planning","extracted_events":[],"retrieved_memories":[{"memory_content":"历史"}],"user_profile":{},"current_goal":{},"generated_plan":[{"old":1}],"reflection_result":{},"assistant_response":"unchanged"}


class PlanningAgentTest(unittest.TestCase):
    def test_valid_plan_has_fixed_shape(self):
        llm = CallableLLMService(lambda *_: json.dumps([{"task_name":"复习","start_time":"09:00","duration_minutes":60,"difficulty":0.5}]))
        s = state(); result = PlanningAgent(llm).process(s)
        self.assertEqual(result["generated_plan"][0]["task_name"], "复习")
        self.assertEqual(result["assistant_response"], "unchanged")

    def test_invalid_json_degrades_to_empty_plan(self):
        s = state(); PlanningAgent(CallableLLMService(lambda *_: "not json")).process(s)
        self.assertEqual(s["generated_plan"], [])

    def test_llm_error_degrades_to_empty_plan(self):
        s = state(); PlanningAgent(CallableLLMService(lambda *_: (_ for _ in ()).throw(RuntimeError("down")))).process(s)
        self.assertEqual(s["generated_plan"], [])

    def test_empty_json_plan_uses_executable_fallback(self):
        s = state()
        PlanningAgent(CallableLLMService(lambda *_: "[]")).process(s)
        self.assertEqual(len(s["generated_plan"]), 1)
        self.assertEqual(
            set(s["generated_plan"][0]),
            {"task_name", "start_time", "duration_minutes", "difficulty"},
        )


if __name__ == "__main__": unittest.main()
