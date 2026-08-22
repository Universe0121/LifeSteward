"""Application settings loaded from environment variables."""

from dataclasses import dataclass
import os

from core.providers.qwen_provider import DASHSCOPE_COMPATIBLE_BASE_URL


@dataclass(frozen=True)
class AppSettings:
    """Strongly typed runtime settings for backend services."""

    postgres_dsn: str
    redis_url: str
    llm_provider: str
    model_name: str
    dashscope_api_key: str
    dashscope_base_url: str
    temperature: float


def load_settings() -> AppSettings:
    """Load the current process configuration from environment variables."""

    return AppSettings(
        postgres_dsn=os.getenv("POSTGRES_DSN", "").strip(),
        redis_url=os.getenv("REDIS_URL", "").strip(),
        llm_provider=os.getenv("LLM_PROVIDER", "qwen").strip().lower(),
        model_name=os.getenv("MODEL_NAME", "").strip() or "qwen-plus",
        dashscope_api_key=os.getenv("DASHSCOPE_API_KEY", "").strip(),
        dashscope_base_url=os.getenv(
            "DASHSCOPE_BASE_URL",
            DASHSCOPE_COMPATIBLE_BASE_URL,
        ).strip(),
        temperature=float(os.getenv("TEMPERATURE", "0.7")),
    )
