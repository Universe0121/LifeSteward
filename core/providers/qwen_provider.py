"""Qwen adapter using the DashScope OpenAI-compatible API."""

import json
from collections.abc import Mapping
from typing import Any

from core.llm_service import LLMService


DASHSCOPE_COMPATIBLE_BASE_URL = (
    "https://dashscope.aliyuncs.com/compatible-mode/v1"
)


class QwenProvider(LLMService):
    def __init__(
        self,
        api_key: str,
        model_name: str = "qwen-plus",
        base_url: str = DASHSCOPE_COMPATIBLE_BASE_URL,
        temperature: float = 0.7,
        client: Any | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("DASHSCOPE_API_KEY is required")
        if not model_name:
            raise ValueError("MODEL_NAME is required")

        if client is None:
            try:
                from openai import OpenAI
            except ImportError as exc:
                raise RuntimeError(
                    "The openai package is required for Qwen model calls."
                ) from exc

            client = OpenAI(api_key=api_key, base_url=base_url)

        self._client = client
        self._model_name = model_name
        self._temperature = temperature

    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        response = self._client.chat.completions.create(
            model=self._model_name,
            temperature=self._temperature,
            messages=[
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": json.dumps(
                        dict(variables),
                        ensure_ascii=False,
                        default=str,
                    ),
                },
            ],
        )
        content = self._extract_content(response)
        if not content:
            raise RuntimeError("Qwen returned an empty response")
        return content.strip()

    @classmethod
    def _extract_content(cls, response: Any) -> str:
        if isinstance(response, str):
            content = response.strip()
            if not content:
                return ""
            normalized_content = content.lower()
            if normalized_content.startswith("<!doctype html") or (
                normalized_content.startswith("<html")
            ):
                raise RuntimeError(
                    "Qwen endpoint returned HTML. Check that "
                    "DASHSCOPE_BASE_URL points to the API path, usually /v1."
                )
            try:
                parsed_response = json.loads(content)
            except json.JSONDecodeError:
                return content
            return cls._extract_content(parsed_response)

        if isinstance(response, Mapping):
            choices = response.get("choices") or []
            if choices:
                message = choices[0].get("message") or {}
                return cls._normalize_content(message.get("content"))
            return cls._normalize_content(response.get("output_text"))

        choices = getattr(response, "choices", None) or []
        if choices:
            message = getattr(choices[0], "message", None)
            return cls._normalize_content(getattr(message, "content", None))
        return cls._normalize_content(getattr(response, "output_text", None))

    @staticmethod
    def _normalize_content(content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            text_parts = []
            for item in content:
                if isinstance(item, Mapping) and isinstance(item.get("text"), str):
                    text_parts.append(item["text"])
                elif isinstance(item, str):
                    text_parts.append(item)
            return "".join(text_parts)
        return ""
