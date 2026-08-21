"""Manual smoke test for the real core Agent workflow."""

import json
import sys
from pathlib import Path

backend_directory = Path(__file__).resolve().parents[1]
if str(backend_directory) not in sys.path:
    sys.path.insert(0, str(backend_directory))

from dotenv import load_dotenv

from agents.master_agent import MasterAgent
from agents.state import AgentState
from core.llm_service import configure_llm_service_from_environment


def main() -> None:
    load_dotenv(backend_directory / ".env")
    llm_service = configure_llm_service_from_environment()
    state: AgentState = {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "conversation_id": "conv_real_001",
        "user_input": "今天学习数学2小时，很累，昨晚睡了6小时",
        "intent": "",
        "extracted_events": [],
        "retrieved_memories": [],
        "user_profile": {},
        "current_goal": {},
        "generated_plan": [],
        "reflection_result": {},
        "assistant_response": "",
    }
    result = MasterAgent(llm_service=llm_service).process(state)
    print(
        json.dumps(
            {
                "intent": result["intent"],
                "extracted_events": result["extracted_events"],
                "assistant_response": result["assistant_response"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
