"""Agent responsible for memory retrieval and event persistence boundaries."""

from __future__ import annotations

from agents.intent import Intent
from agents.state import AgentState
from services.memory_service import MemoryService


class MemoryAgent:
    """Build memory queries and delegate all memory operations to MemoryService."""

    def __init__(self, memory_service: MemoryService) -> None:
        self.memory_service = memory_service

    def process(self, state: AgentState) -> AgentState:
        """Process one AgentState and only assign state['retrieved_memories']."""
        user_id = state["user_id"]
        user_input = state["user_input"]
        intent = state["intent"]
        extracted_events = state["extracted_events"]

        # Initialize the only AgentState field this Agent owns.
        state["retrieved_memories"] = []

        try:
            if intent == Intent.RECORD_EVENT.value:
                if extracted_events:
                    self.memory_service.save_memory(user_id, extracted_events)
                return state

            if self._should_retrieve(intent):
                memory_query = self.build_memory_query(
                    user_input=user_input,
                    intent=intent,
                    extracted_events=extracted_events,
                )
                state["retrieved_memories"] = self.memory_service.search_memory(
                    user_id,
                    memory_query,
                    top_k=5,
                )
        except Exception:
            state["retrieved_memories"] = []

        return state

    @staticmethod
    def _should_retrieve(intent: str) -> bool:
        return intent in {
            Intent.QUERY_MEMORY.value,
            Intent.REFLECTION.value,
            Intent.PLANNING.value,
        }

    @staticmethod
    def build_memory_query(
        user_input: str,
        intent: str = Intent.QUERY_MEMORY.value,
        extracted_events: list[dict] | None = None,
    ) -> str:
        if "学习效率" in user_input or "效率" in user_input:
            return "用户最近学习效率变化相关的历史事件、压力状态、睡眠情况和有效调整经验"
        if "压力" in user_input or "焦虑" in user_input:
            return "用户过去压力或焦虑时期采取过的调整措施及其结果"
        if any(term in user_input for term in ("累", "疲惫", "感觉怎么样", "状态")):
            return "用户最近的情绪、疲劳和身体状态记录"
        if any(term in user_input for term in ("累", "疲惫", "感觉怎么样", "状态")):
            return "用户最近的情绪、疲劳和身体状态记录"
        if "睡眠" in user_input or "睡" in user_input:
            return "用户过去的睡眠情况及其与学习、情绪和精力相关的历史记录"
        if "代码" in user_input or "编程" in user_input:
            return "用户今天及过去写代码、编程的时长记录"
        if any(term in user_input for term in ("吃", "饭", "饮食")):
            return "用户今天及过去的饮食和吃饭记录"
        if extracted_events:
            event_text = "、".join(
                str(event.get("event_content", ""))
                for event in extracted_events
                if event.get("event_content")
            )
            if event_text:
                return f"用户关于“{event_text}”的历史生活记录和有效经验"
        return f"用户关于“{user_input}”的{intent}相关历史记录和有效经验"
