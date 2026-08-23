"""Master Agent that classifies intent and dispatches the workflow."""

import json
from collections.abc import Callable

from agents.intent import Intent
from agents.interaction_agent import InteractionAgent
from agents.life_understanding_agent import LifeUnderstandingAgent
from agents.memory_agent import MemoryAgent
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
    ) -> None:
        self._life_understanding_agent = (
            life_understanding_agent or LifeUnderstandingAgent(llm_service)
        )
        self._interaction_agent = interaction_agent or InteractionAgent(llm_service)
        self._memory_agent = memory_agent or MemoryAgent(
            memory_service or InMemoryMemoryService()
        )
        self._reflection_agent = reflection_agent or ReflectionAgent(llm_service)
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
            Intent.PLANNING.value: (self._memory_agent.process,),
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
            return self._parse_intent(raw_response)
        except (RuntimeError, ValueError, json.JSONDecodeError):
            return Intent.CASUAL_CHAT.value

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
