"""Create simulation data through the production Agent/chat workflow."""
from __future__ import annotations
import argparse, json, os, sys
from datetime import UTC, datetime
from pathlib import Path
from urllib import error, request

try:  # pragma: no cover - optional local convenience dependency
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - tests can run without python-dotenv
    def load_dotenv(*args, **kwargs):
        return False

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
from core.database import DatabaseClient

DEFAULT_USER_ID = "10001"
SCENARIOS = [
    "昨晚睡眠不足，凌晨一点才入睡，早上七点起床。", "上午完成了数学复习，专注约九十分钟。",
    "下午任务堆积时感到压力明显上升。", "傍晚快走三十分钟后，精神状态有所恢复。",
    "午餐吃得比较规律，蔬菜和蛋白质充足。", "连续处理复杂任务两小时后注意力开始下降。",
    "午后休息二十分钟，之后学习效率明显改善。", "完成当天主要目标后心情轻松，成就感较强。",
    "晚上和朋友交流近况，焦虑感有所缓解。", "睡前整理了明日任务，并把高难度任务放在上午。",
]

def build_messages(count: int) -> list[str]:
    return [f"请记录这条生活事件（仿真数据第{i + 1}条）：{SCENARIOS[i % len(SCENARIOS)]}" for i in range(count)]

def post_chat(api_base: str, user_id: str, conversation_id: str, message: str) -> dict:
    body = json.dumps({"user_id": int(user_id), "conversation_id": conversation_id, "user_input": message}, ensure_ascii=False).encode("utf-8")
    req = request.Request(f"{api_base.rstrip('/')}/api/v1/chat", data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with request.urlopen(req, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        raise RuntimeError(f"chat request failed: {exc.code} {exc.read().decode('utf-8', errors='replace')}") from exc

def verify_persistence(user_id: str, conversation_id: str) -> dict:
    """Read-only evidence; all writes must already have happened via Agent."""
    row = DatabaseClient.from_environment().fetch_one(
        """SELECT COUNT(DISTINCT le.id) AS event_count,
        COUNT(DISTINCT m.id) AS memory_count,
        COUNT(DISTINCT m.id) FILTER (WHERE m.embedding IS NOT NULL) AS embedded_memory_count
        FROM life_events le LEFT JOIN memories m ON m.source_event_id = le.id
        WHERE le.user_id = %s AND le.conversation_id = %s""", (user_id, conversation_id))
    return dict(row or {})

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", default=DEFAULT_USER_ID)
    parser.add_argument("--count", type=int, default=50)
    parser.add_argument("--api-base", default=os.getenv("LIFE_STEWARD_API_BASE", "http://127.0.0.1:8000"))
    parser.add_argument("--conversation-id", default="")
    args = parser.parse_args()
    if not 1 <= args.count <= 200:
        parser.error("--count must be between 1 and 200")
    load_dotenv(BACKEND_DIR / ".env", override=False)
    conversation_id = args.conversation_id or datetime.now(UTC).strftime("simulation_agent_%Y%m%d_%H%M%S")
    messages = build_messages(args.count)
    for index, message in enumerate(messages, 1):
        result = post_chat(args.api_base, args.user_id, conversation_id, message)
        if result.get("intent") != "record_event":
            raise RuntimeError(f"message {index} was routed as {result.get('intent')!r}")
        if not result.get("extracted_events"):
            raise RuntimeError(f"message {index} produced no extracted event")
        print(f"[{index:02d}/{len(messages)}] Agent persisted {len(result['extracted_events'])} event(s)")
    print(json.dumps({"conversation_id": conversation_id, **verify_persistence(args.user_id, conversation_id)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
