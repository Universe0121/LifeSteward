"""Qwen adapter using the DashScope OpenAI-compatible API."""

import json
import time
from collections.abc import Mapping
from typing import Any

from core.llm_service import LLMResponseError, LLMService, LLMTimeoutError


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
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_backoff: float = 0.2,
        embedding_model_name: str = "text-embedding-v3",
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
        self._timeout = timeout
        self._max_retries = max(0, int(max_retries))
        self._retry_backoff = max(0.0, float(retry_backoff))
        self._embedding_model_name = embedding_model_name

    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        request = {
            "model": self._model_name,
            "temperature": self._temperature,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(dict(variables), ensure_ascii=False, default=str)},
            ],
            "timeout": self._timeout,
        }
        for attempt in range(self._max_retries + 1):
            try:
                content = self._extract_content(self._client.chat.completions.create(**request))
                if not content:
                    raise LLMResponseError("Qwen returned an empty response")
                return content.strip()
            except TimeoutError as exc:
                if attempt == self._max_retries:
                    raise LLMTimeoutError("Qwen request timed out") from exc
            except Exception as exc:
                if attempt == self._max_retries:
                    if isinstance(exc, LLMResponseError):
                        raise
                    raise LLMResponseError(f"Qwen request failed after {attempt + 1} attempts: {exc}") from exc
            if self._retry_backoff:
                time.sleep(self._retry_backoff * (2**attempt))
        raise LLMResponseError("Qwen request failed")

    def embed_text(self, text: str) -> list[float]:
        if not text.strip():
            return []
        try:
            response = self._client.embeddings.create(
                model=self._embedding_model_name,
                input=text,
                timeout=self._timeout,
            )
            data = response.get("data", []) if isinstance(response, Mapping) else getattr(response, "data", [])
            first = data[0] if data else None
            embedding = first.get("embedding") if isinstance(first, Mapping) else getattr(first, "embedding", None)
            if not isinstance(embedding, list) or not embedding:
                raise LLMResponseError("Qwen returned an invalid embedding")
            return [float(value) for value in embedding]
        except TimeoutError as exc:
            raise LLMTimeoutError("Qwen embedding request timed out") from exc
        except LLMResponseError:
            raise
        except Exception as exc:
            raise LLMResponseError(f"Qwen embedding request failed: {exc}") from exc

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
