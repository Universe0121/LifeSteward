"""Master Agent that classifies intent and dispatches the workflow."""

import json
from collections.abc import Callable

from agents.intent import Intent
from agents.interaction_agent import InteractionAgent
from agents.life_understanding_agent import LifeUnderstandingAgent
from agents.memory_agent import MemoryAgent
from agents.planning_agent import PlanningAgent
from agents.reflection_agent import ReflectionAgent
from agents.state import AgentState
from core.llm_service import LLMService, get_llm_service, load_prompt
from services.memory_service import InMemoryMemoryService, MemoryService


class MasterAgent:
    _prompt_name = "intent_classification_prompt.md"

    def __init__(
        self,
        memory_service: MemoryService | None = None,
        life_understanding_agent: LifeUnderstandingAgent | None = None,
        interaction_agent: InteractionAgent | None = None,
        memory_agent: MemoryAgent | None = None,
        llm_service: LLMService | None = None,
        reflection_agent: ReflectionAgent | None = None,
        planning_agent: PlanningAgent | None = None,
    ) -> None:
        self._life_understanding_agent = (
            life_understanding_agent or LifeUnderstandingAgent(llm_service)
        )
        self._interaction_agent = interaction_agent or InteractionAgent(llm_service)
        self._memory_agent = memory_agent or MemoryAgent(
            memory_service or InMemoryMemoryService()
        )
        self._reflection_agent = reflection_agent or ReflectionAgent(llm_service)
        self._planning_agent = planning_agent or PlanningAgent(llm_service)
        self._llm_service = llm_service
        self._intent_handlers: dict[
            str,
            tuple[Callable[[AgentState], AgentState], ...],
        ] = {
            Intent.RECORD_EVENT.value: (
                self._life_understanding_agent.process,
                self._memory_agent.process,
            ),
            Intent.QUERY_MEMORY.value: (self._memory_agent.process,),
            Intent.REFLECTION.value: (
                self._memory_agent.process,
                self._reflection_agent.process,
            ),
            Intent.PLANNING.value: (
                self._memory_agent.process,
                self._planning_agent.process,
            ),
        }

    def process(self, state: AgentState) -> AgentState:
        self._initialize_state(state)
        state["intent"] = self._resolve_intent(state)

        for handler in self._intent_handlers.get(state["intent"], ()):
            state = handler(state)

        return self._interaction_agent.process(state)

    def _resolve_intent(self, state: AgentState) -> str:
        existing_intent = state.get("intent", "")
        if Intent.contains(existing_intent):
            return existing_intent

        llm_service = self._llm_service or get_llm_service()
        try:
            raw_response = llm_service.generate(
                load_prompt(self._prompt_name),
                {"user_input": state["user_input"]},
            )
            model_intent = self._parse_intent(raw_response)
            if model_intent == Intent.CASUAL_CHAT.value:
                return self._classify_clear_intent(state["user_input"]) or model_intent
            return model_intent
        except (RuntimeError, ValueError, json.JSONDecodeError):
            return (
                self._classify_clear_intent(state["user_input"])
                or Intent.CASUAL_CHAT.value
            )

    @staticmethod
    def _classify_clear_intent(user_input: str) -> str | None:
        """Route explicit Chinese requests without depending on model variance."""
        text = str(user_input).strip()
        if not text:
            return None
        if any(term in text for term in ("计划", "安排明天", "安排今天", "日程")):
            return Intent.PLANNING.value
        if any(term in text for term in ("为什么", "原因", "复盘", "规律", "趋势")):
            return Intent.REFLECTION.value
        if any(term in text for term in ("记录了什么", "多少次", "多久", "查一下", "回忆")):
            return Intent.QUERY_MEMORY.value
        record_terms = (
            "今天", "昨天", "昨晚", "刚刚", "最近", "睡", "学习", "工作",
            "吃", "运动", "压力", "焦虑", "开心", "难过", "累", "疲惫",
        )
        if any(term in text for term in record_terms):
            return Intent.RECORD_EVENT.value
        return None

    @staticmethod
    def _parse_intent(raw_response: str) -> str:
        content = raw_response.strip()
        try:
            payload = json.loads(content)
            intent = payload.get("intent", "") if isinstance(payload, dict) else ""
        except json.JSONDecodeError:
            intent = content.strip('"')
        if not Intent.contains(intent):
            raise ValueError(f"Unsupported intent: {intent}")
        return intent

    @staticmethod
    def _initialize_state(state: AgentState) -> None:
        state.setdefault("intent", "")
        state.setdefault("extracted_events", [])
        state.setdefault("retrieved_memories", [])
        state.setdefault("user_profile", {})
        state.setdefault("current_goal", {})
        state.setdefault("generated_plan", [])
        state.setdefault("reflection_result", {})
        state.setdefault("assistant_response", "")
