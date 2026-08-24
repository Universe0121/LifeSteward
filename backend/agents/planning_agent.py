"""Planning Agent: generate a fixed, executable plan from AgentState."""
from __future__ import annotations

import json
import math
import re
from collections.abc import Mapping
from typing import Any
from agents.state import AgentState
from core.llm_service import LLMService, get_llm_service, load_prompt


class PlanningAgent:
    _prompt_name = "planning_prompt.md"
    _required_fields = ("task_name", "start_time", "duration_minutes", "difficulty")
    _time_pattern = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")

    def __init__(self, llm_service: LLMService | None = None) -> None:
        self._llm_service = llm_service

    def process(self, state: AgentState) -> AgentState:
        state["generated_plan"] = []
        raw = ""
        try:
            raw = (self._llm_service or get_llm_service()).generate(
                load_prompt(self._prompt_name),
                {k: state.get(k) for k in ("user_input", "user_profile", "current_goal", "retrieved_memories", "reflection_result")},
            )
            payload = self._decode_payload(raw)
            if not isinstance(payload, list):
                raise ValueError("plan must be a list")
            plan = []
            for item in payload:
                if not isinstance(item, dict):
                    raise ValueError("invalid task")
                if not isinstance(item, Mapping) or set(item) != set(self._required_fields):
                    raise ValueError("missing task field")
                if not isinstance(item["task_name"], str) or not item["task_name"].strip():
                    raise ValueError("invalid task types")
                if not isinstance(item["start_time"], str) or not self._time_pattern.fullmatch(item["start_time"]):
                    raise ValueError("invalid start_time")
                if isinstance(item["duration_minutes"], bool) or not isinstance(item["duration_minutes"], int) or item["duration_minutes"] <= 0:
                    raise ValueError("invalid numeric fields")
                if isinstance(item["difficulty"], bool) or not isinstance(item["difficulty"], (int, float)) or not math.isfinite(float(item["difficulty"])) or not 0 <= float(item["difficulty"]) <= 1:
                    raise ValueError("invalid difficulty")
                plan.append({key: item[key] for key in self._required_fields})
            state["generated_plan"] = plan or self._fallback_plan(state)
        except (Exception,):
            # Providers occasionally return a useful natural-language plan
            # despite the JSON-only contract. Preserve an executable fallback
            # instead of silently losing the planning result.
            if len(str(raw).strip()) >= 20:
                state["generated_plan"] = self._fallback_plan(state)
        return state

    @staticmethod
    def _decode_payload(raw: str) -> Any:
        text = str(raw).strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            fenced = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.S | re.I)
            if fenced:
                return json.loads(fenced.group(1))
            match = re.search(r"(\[\s*\{.*\}\s*\])", text, re.S)
            if match:
                return json.loads(match.group(1))
            raise

    @staticmethod
    def _fallback_plan(state: AgentState) -> list[dict[str, Any]]:
        goal = state.get("current_goal") or {}
        goal_name = goal.get("goal") if isinstance(goal, dict) else None
        task_name = str(goal_name or "重点学习与复习").strip() or "重点学习与复习"
        return [
            {
                "task_name": task_name,
                "start_time": "09:00",
                "duration_minutes": 60,
                "difficulty": 0.5,
            }
        ]
