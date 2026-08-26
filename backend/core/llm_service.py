"""Central model boundary used by every Agent."""

import os
from collections.abc import Callable, Mapping
from pathlib import Path

from dotenv import load_dotenv
from typing import Any


class LLMError(RuntimeError):
    """Base error for failures at the provider boundary."""


class LLMTimeoutError(LLMError):
    """The provider did not respond within the configured timeout."""


class LLMResponseError(LLMError):
    """The provider returned an unusable response."""


class LLMService:
    """Provider-independent model interface.

    A concrete provider adapter is configured at application startup. Agents
    depend only on this interface and never initialize a model directly.
    """

    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        raise NotImplementedError

    def embed_text(self, text: str) -> list[float]:
        """Convert text to an embedding through the configured provider."""
        raise NotImplementedError


class CallableLLMService(LLMService):
    """Small adapter for provider clients and deterministic tests."""

    def __init__(
        self,
        generator: Callable[[str, Mapping[str, Any]], str],
        embedder: Callable[[str], list[float]] | None = None,
    ) -> None:
        self._generator = generator
        self._embedder = embedder

    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        return self._generator(prompt, variables)

    def embed_text(self, text: str) -> list[float]:
        if self._embedder is None:
            raise RuntimeError("Embedding service is not configured")
        return self._embedder(text)


class _UnconfiguredLLMService(LLMService):
    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        raise RuntimeError(
            "LLMService is not configured. Configure a provider adapter "
            "during application startup."
        )

    def embed_text(self, text: str) -> list[float]:
        raise RuntimeError("LLMService is not configured")


_llm_service: LLMService = _UnconfiguredLLMService()
_prompt_directory = Path(__file__).resolve().parents[1] / "prompts"


def configure_llm_service(llm_service: LLMService) -> None:
    """Configure the process-wide model boundary during application startup."""

    global _llm_service
    _llm_service = llm_service


def get_llm_service() -> LLMService:
    return _llm_service


def create_llm_service_from_environment() -> LLMService:
    """Create the configured Qwen provider."""

    provider = os.getenv("LLM_PROVIDER", "qwen").strip().lower()
    model_name = os.getenv("MODEL_NAME", "").strip()

    if provider not in {"qwen", "stepfun"}:
        raise ValueError("Only the qwen or stepfun LLM provider is enabled")

    from core.providers.qwen_provider import (
        DASHSCOPE_COMPATIBLE_BASE_URL,
        QwenProvider,
    )

    return QwenProvider(
        api_key=os.getenv("STEP_API_KEY", os.getenv("DASHSCOPE_API_KEY", "")),
        model_name=model_name or ("step-3.7-flash" if provider == "stepfun" else "qwen-plus"),
        base_url=os.getenv(
            "STEP_BASE_URL" if provider == "stepfun" else "DASHSCOPE_BASE_URL",
            "https://api.stepfun.com/step_plan/v1" if provider == "stepfun" else DASHSCOPE_COMPATIBLE_BASE_URL,
        ),
        temperature=float(os.getenv("TEMPERATURE", "0.7")),
        timeout=float(os.getenv("LLM_TIMEOUT", "30")),
        max_retries=int(os.getenv("LLM_MAX_RETRIES", "3")),
        retry_backoff=float(os.getenv("LLM_RETRY_BACKOFF", "0.2")),
        embedding_model_name=os.getenv(
            "EMBEDDING_MODEL_NAME", "text-embedding-v3"
        ).strip(),
    )


def configure_llm_service_from_environment() -> LLMService:
    """Create and register the provider configured by the environment."""

    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(dotenv_path=env_path)

    llm_service = create_llm_service_from_environment()
    configure_llm_service(llm_service)
    return llm_service


def load_prompt(prompt_name: str) -> str:
    """Load a prompt from the managed prompt directory."""

    prompt_path = (_prompt_directory / prompt_name).resolve()
    if prompt_path.parent != _prompt_directory.resolve():
        raise ValueError("Prompt files must be loaded from the prompt directory")
    return prompt_path.read_text(encoding="utf-8")
