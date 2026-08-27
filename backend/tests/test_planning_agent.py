import json
import unittest

from agents.planning_agent import PlanningAgent
from core.llm_service import CallableLLMService


class PlanningAgentTest(unittest.TestCase):
    def test_valid_plan_has_fixed_shape(self) -> None:
        state = {
            "user_id": "u",
            "conversation_id": "c",
            "user_input": "制定计划",
            "intent": "planning",
            "extracted_events": [],
            "retrieved_memories": [],
            "user_profile": {},
            "current_goal": {},
            "generated_plan": [],
            "reflection_result": {},
            "assistant_response": "保持不变",
        }
        response = json.dumps(
            [
                {
                    "task_name": "复习数学",
                    "start_time": "09:00",
                    "duration_minutes": 60,
                    "difficulty": 0.5,
                }
            ]
        )

        result = PlanningAgent(
            CallableLLMService(lambda prompt, variables: response)
        ).process(state)

        self.assertEqual(result["generated_plan"][0]["task_name"], "复习数学")
        self.assertEqual(result["assistant_response"], "保持不变")

    def test_invalid_json_uses_complete_fallback_plan(self) -> None:
        state = {
            "user_input": "制定计划",
            "user_profile": {},
            "current_goal": {},
            "retrieved_memories": [],
            "reflection_result": {},
            "generated_plan": [{"old": True}],
            "assistant_response": "保持不变",
        }

        PlanningAgent(
            CallableLLMService(lambda prompt, variables: "not json")
        ).process(state)

        self.assertEqual(
            set(state["generated_plan"][0]),
            {"task_name", "start_time", "duration_minutes", "difficulty"},
        )
        self.assertEqual(state["assistant_response"], "保持不变")

    def test_empty_plan_uses_goal_based_fallback(self) -> None:
        state = {
            "user_input": "制定计划",
            "user_profile": {},
            "current_goal": {"goal": "准备数学考试"},
            "retrieved_memories": [],
            "reflection_result": {},
            "generated_plan": [],
            "assistant_response": "",
        }

        PlanningAgent(
            CallableLLMService(lambda prompt, variables: "[]")
        ).process(state)

        self.assertEqual(len(state["generated_plan"]), 1)
        self.assertEqual(
            state["generated_plan"][0]["task_name"],
            "准备数学考试",
        )

    def test_llm_error_uses_complete_fallback_plan(self) -> None:
        state = {
            "user_input": "制定计划",
            "user_profile": {},
            "current_goal": {},
            "retrieved_memories": [],
            "reflection_result": {},
            "generated_plan": [{"old": True}],
            "assistant_response": "",
        }

        def raise_error(prompt, variables):
            raise RuntimeError("LLM unavailable")

        PlanningAgent(CallableLLMService(raise_error)).process(state)

        self.assertEqual(
            set(state["generated_plan"][0]),
            {"task_name", "start_time", "duration_minutes", "difficulty"},
        )
if __name__ == "__main__":
    unittest.main()
