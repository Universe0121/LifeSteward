"""Chat service orchestration."""

from agents.master_agent import MasterAgent
from agents.state import AgentState
from schemas.chat_schema import ChatRequest, ChatResponse


def process_chat_message(chat_request: ChatRequest) -> ChatResponse:
    """Convert a chat request into AgentState and invoke MasterAgent."""

    agent_state: AgentState = {
        "user_id": chat_request.user_id,
        "conversation_id": chat_request.conversation_id,
        "user_input": chat_request.user_input,
        "intent": "",
        "extracted_events": [],
        "retrieved_memories": [],
        "user_profile": {},
        "current_goal": {},
        "generated_plan": [],
        "reflection_result": {},
        "assistant_response": "",
    }

    try:
        master_agent = MasterAgent()
        result_state = master_agent.process(agent_state)
        return ChatResponse(
            assistant_response=result_state.get("assistant_response", ""),
            intent=result_state.get("intent", ""),
            extracted_events=result_state.get("extracted_events", []),
        )
    except Exception:
        return ChatResponse(
            assistant_response="",
            intent="",
            extracted_events=[],
        )

