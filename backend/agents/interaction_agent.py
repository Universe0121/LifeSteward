"""Agent that produces the only user-facing response in the workflow."""

from agents.intent import Intent
from agents.state import AgentState
from core.llm_service import LLMService, get_llm_service, load_prompt


class InteractionAgent:
    _prompt_name = "interaction_prompt.md"

    def __init__(self, llm_service: LLMService | None = None) -> None:
        self._llm_service = llm_service

    def process(self, state: AgentState) -> AgentState:
        if state["intent"] in {
            Intent.QUERY_MEMORY.value,
            Intent.REFLECTION.value,
        } and not state.get("retrieved_memories"):
            state["assistant_response"] = self._no_evidence_response(state)
            return state
        if state["intent"] == Intent.RECORD_EVENT.value and not state.get("extracted_events"):
            state["assistant_response"] = self._fallback_response(state)
            return state
        llm_service = self._llm_service or get_llm_service()
        try:
            state["assistant_response"] = llm_service.generate(
                load_prompt(self._prompt_name),
                {
                    "user_input": state["user_input"],
                    "intent": state["intent"],
                    "extracted_events": state["extracted_events"],
                    "retrieved_memories": state["retrieved_memories"],
                    "user_profile": state["user_profile"],
                    "current_goal": state["current_goal"],
                    "generated_plan": state["generated_plan"],
                    "reflection_result": state["reflection_result"],
                    "conversation_history": state.get("conversation_history", []),
                },
            ).strip()
        except (RuntimeError, ValueError):
            state["assistant_response"] = self._fallback_response(state)
        return state

    @staticmethod
    def _no_evidence_response(state: AgentState) -> str:
        if state["intent"] == Intent.REFLECTION.value:
            return "目前找到的相关记录还不够，我不想替你猜测。再记录几次后，我可以基于真实记录帮你分析。"
        return "我暂时没有找到与你的问题相关的历史记录。"

    def _fallback_response(self, state: AgentState) -> str:
        if state["intent"] == Intent.RECORD_EVENT.value:
            event_count = len(state["extracted_events"])
            if event_count:
                return f"已经帮你记录了{event_count}条生活信息，你可以随时修改。"
            return "我还没能确认需要记录的内容，可以再具体说一点吗？"
        return "我已经收到你的消息。"
