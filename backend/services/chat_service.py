"""Chat service orchestration."""

from copy import deepcopy

from agents.master_agent import MasterAgent
from agents.state import AgentState
from core.database import DatabaseClient
from core.llm_service import configure_llm_service_from_environment
from schemas.chat_schema import ChatRequest, ChatResponse
from services.memory_service import ToolMemoryService
from tools.sql_tool import SQLTool
from tools.vector_search_tool import VectorSearchTool


class AgentProcessingError(RuntimeError):
    """Raised when the agent workflow cannot complete successfully."""


_DEFAULT_AGENT_STATE: AgentState = {
    "user_id": "",
    "conversation_id": "",
    "user_input": "",
    "intent": "",
    "extracted_events": [],
    "retrieved_memories": [],
    "user_profile": {},
    "current_goal": {},
    "generated_plan": [],
    "reflection_result": {},
    "assistant_response": "",
}


def build_agent_state(chat_request: ChatRequest) -> AgentState:
    """Build the canonical AgentState payload for a chat request."""

    agent_state: AgentState = deepcopy(_DEFAULT_AGENT_STATE)
    agent_state.update(
        {
            "user_id": str(chat_request.user_id),
            "conversation_id": chat_request.conversation_id,
            "user_input": chat_request.user_input,
        }
    )
    return agent_state


def process_chat_message(
    chat_request: ChatRequest,
    master_agent: MasterAgent | None = None,
) -> ChatResponse:
    """Convert a chat request into AgentState and invoke MasterAgent."""

    agent_state = build_agent_state(chat_request)

    try:
        resolved_master_agent = master_agent or create_default_master_agent()
        result_state = resolved_master_agent.process(agent_state)
        return ChatResponse(
            assistant_response=result_state.get("assistant_response", ""),
            intent=result_state.get("intent", ""),
            extracted_events=result_state.get("extracted_events", []),
        )
    except Exception as exc:
        raise AgentProcessingError("Failed to process chat message") from exc


def create_default_master_agent() -> MasterAgent:
    """Build the production workflow from the configured real dependencies.

    Configuration or database failures intentionally propagate. Falling back to
    ``MasterAgent()`` here would silently replace PostgreSQL/pgvector with the
    in-memory fake and make production appear healthy while losing persistence.
    Tests and local demos should inject an explicit ``MasterAgent`` instead.
    """

    llm_service = configure_llm_service_from_environment()
    database_client = DatabaseClient.from_environment()
    memory_service = ToolMemoryService(
        SQLTool(database_client),
        VectorSearchTool(database_client),
        llm_service,
    )
    return MasterAgent(memory_service=memory_service, llm_service=llm_service)
