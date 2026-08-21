"""Central model boundary used by every Agent."""

import os
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any


class LLMService:
    """Provider-independent model interface.

    A concrete provider adapter is configured at application startup. Agents
    depend only on this interface and never initialize a model directly.
    """

    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        raise NotImplementedError


class CallableLLMService(LLMService):
    """Small adapter for provider clients and deterministic tests."""

    def __init__(
        self,
        generator: Callable[[str, Mapping[str, Any]], str],
    ) -> None:
        self._generator = generator

    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        return self._generator(prompt, variables)


class _UnconfiguredLLMService(LLMService):
    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        raise RuntimeError(
            "LLMService is not configured. Configure a provider adapter "
            "during application startup."
        )


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

    if provider != "qwen":
        raise ValueError("Only the qwen LLM provider is enabled")

    from core.providers.qwen_provider import (
        DASHSCOPE_COMPATIBLE_BASE_URL,
        QwenProvider,
    )

    return QwenProvider(
        api_key=os.getenv("DASHSCOPE_API_KEY", ""),
        model_name=model_name or "qwen-plus",
        base_url=os.getenv(
            "DASHSCOPE_BASE_URL",
            DASHSCOPE_COMPATIBLE_BASE_URL,
        ),
        temperature=float(os.getenv("TEMPERATURE", "0.7")),
    )


def configure_llm_service_from_environment() -> LLMService:
    """Create and register the provider configured by the environment."""

    llm_service = create_llm_service_from_environment()
    configure_llm_service(llm_service)
    return llm_service


def load_prompt(prompt_name: str) -> str:
    """Load a prompt from the managed prompt directory."""

    prompt_path = (_prompt_directory / prompt_name).resolve()
    if prompt_path.parent != _prompt_directory.resolve():
        raise ValueError("Prompt files must be loaded from the prompt directory")
    return prompt_path.read_text(encoding="utf-8")
