"""Manual smoke test for the configured real model provider."""

import sys
from pathlib import Path

backend_directory = Path(__file__).resolve().parents[1]
if str(backend_directory) not in sys.path:
    sys.path.insert(0, str(backend_directory))

from dotenv import load_dotenv

from core.llm_service import configure_llm_service_from_environment


def main() -> None:
    load_dotenv(backend_directory / ".env")
    llm_service = configure_llm_service_from_environment()
    response = llm_service.generate(
        "你是模型连接测试助手，只回复 OK。",
        {"user_input": "测试连接"},
    )
    print(response)


if __name__ == "__main__":
    main()
