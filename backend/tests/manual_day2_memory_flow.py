import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from agents.master_agent import MasterAgent
from agents.state import AgentState
from core.llm_service import configure_llm_service_from_environment
from services.memory_service import MockMemoryService


def pick_result(agent, text):
    if hasattr(agent, "run"):
        return agent.run(text)

    if hasattr(agent, "handle"):
        return agent.handle(text)

    if hasattr(agent, "process"):
        state: AgentState = {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "conversation_id": "day2_manual",
            "user_input": text,
            "intent": "",
            "extracted_events": [],
            "retrieved_memories": [],
            "user_profile": {},
            "current_goal": {},
            "generated_plan": [],
            "reflection_result": {},
            "assistant_response": "",
        }
        return agent.process(state)

    if hasattr(agent, "chat"):
        return agent.chat(text)

    if hasattr(agent, "handle_message"):
        return agent.handle_message(text)

    raise AttributeError(
        "MasterAgent has no supported entry method: "
        "run / handle / process / chat / handle_message"
    )


def field(obj, name, default=None):
    if isinstance(obj, dict):
        return obj.get(name, default)

    return getattr(obj, name, default)


def print_case(index, text, result, memory_service):
    print("=" * 80)
    print(f"case: {index}")
    print(f"user_input: {text}")
    print(f"intent: {field(result, 'intent')}")
    print(f"memory_query: {field(result, 'memory_query')}")
    print(f"search_calls: {getattr(memory_service, 'search_calls', [])}")
    print(f"extracted_events: {field(result, 'extracted_events', [])}")
    print(f"retrieved_memories: {field(result, 'retrieved_memories', [])}")
    print(f"assistant_response: {field(result, 'assistant_response')}")
    print(f"error_msg: {field(result, 'error_msg')}")
    print(f"status: {field(result, 'status')}")


def main():
    llm_service = configure_llm_service_from_environment()
    memory_service = MockMemoryService()

    agent = MasterAgent(
        llm_service=llm_service,
        memory_service=memory_service,
    )

    cases = [
        "今天学习数学2小时，很累",
        "最近为什么学习效率越来越低？",
        "我以前压力大的时候有什么有效的调整办法？",
        "讲个笑话吧",
    ]

    for index, text in enumerate(cases, start=1):
        try:
            result = pick_result(agent, text)
            print_case(index, text, result, memory_service)
        except Exception as exc:
            print("=" * 80)
            print(f"case: {index}")
            print(f"user_input: {text}")
            print("intent: None")
            print("memory_query: None")
            print(f"search_calls: {getattr(memory_service, 'search_calls', [])}")
            print("extracted_events: []")
            print("retrieved_memories: []")
            print("assistant_response: None")
            print(f"error_msg: {exc}")
            print("status: error")


if __name__ == "__main__":
    main()
