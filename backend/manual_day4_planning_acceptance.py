"""Run the Day4 planning workflow against production dependencies."""

from __future__ import annotations

import json
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.composition_root import build_composition_root


def main() -> int:
    root = build_composition_root()
    user_id = "acceptance-planning-user"
    # Seed the same production memory store used by the planning request. A
    # planning acceptance run must exercise retrieval from real pgvector, not
    # start with a brand-new user that has no history at all.
    root.memory_service.save_memory(
        user_id,
        [
            {
                "event_type": "study",
                "event_content": "最近连续学习数学两小时，学习效率下降并且压力较大",
            }
        ],
    )
    state = {
        "user_id": user_id,
        "conversation_id": "acceptance-planning-conversation",
        "user_input": "根据我最近的状态，帮我安排明天的学习计划",
        "intent": "planning",
        "extracted_events": [],
        "retrieved_memories": [],
        "user_profile": {},
        "current_goal": {"goal": "提高学习效率"},
        "generated_plan": [],
        "reflection_result": {},
        "assistant_response": "",
    }

    result = root.master_agent.process(state)
    summary = {
        "intent": result["intent"],
        "retrieved_memory_count": len(result["retrieved_memories"]),
        "generated_plan": result["generated_plan"],
        "assistant_response_present": bool(result["assistant_response"].strip()),
        "assistant_response": result["assistant_response"],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    passed = (
        result["intent"] == "planning"
        and bool(result["generated_plan"])
        and bool(result["assistant_response"].strip())
    )
    print("[PASS] Day4 planning acceptance" if passed else "[FAIL] Day4 planning acceptance")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
