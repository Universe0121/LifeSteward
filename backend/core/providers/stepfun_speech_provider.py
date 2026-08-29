"""Small HTTP adapter for the configured StepFun speech endpoint."""

from __future__ import annotations

import json
from collections.abc import Mapping
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class SpeechProviderError(RuntimeError):
    """Raised when the external transcription service cannot be used."""


class StepFunSpeechProvider:
    def __init__(self, base_url: str, api_key: str, model: str, timeout: float = 60.0) -> None:
        if not base_url or not api_key or not model:
            raise ValueError("speech provider configuration is incomplete")
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._timeout = timeout

    def transcribe(self, audio: bytes, filename: str, content_type: str, language: str) -> dict[str, object]:
        boundary = "----LifeAgentSpeechBoundary"
        body = self._multipart_body(boundary, audio, filename, content_type, language)
        request = Request(
            self._base_url,
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Accept": "text/event-stream, application/json",
            },
        )
        try:
            with urlopen(request, timeout=self._timeout) as response:  # noqa: S310 - URL is configured by the operator.
                payload = response.read().decode("utf-8", errors="replace")
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise SpeechProviderError("speech provider request failed") from exc
        parsed = self._parse_response(payload)
        text = self._find_text(parsed)
        if not text:
            raise SpeechProviderError("speech provider returned no transcription")
        duration_ms = self._find_number(parsed, ("duration_ms", "durationMillis"))
        return {"text": text, "language": language, "duration_ms": duration_ms}

    def _multipart_body(self, boundary: str, audio: bytes, filename: str, content_type: str, language: str) -> bytes:
        def field(name: str, value: str) -> bytes:
            return f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()

        header = f"--{boundary}\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n".encode()
        return field("model", self._model) + field("language", language) + header + audio + f"\r\n--{boundary}--\r\n".encode()

    @staticmethod
    def _parse_response(payload: str) -> object:
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            events: list[object] = []
            for line in payload.splitlines():
                if not line.startswith("data:"):
                    continue
                value = line[5:].strip()
                if value and value != "[DONE]":
                    try:
                        events.append(json.loads(value))
                    except json.JSONDecodeError:
                        events.append({"text": value})
            return events

    @classmethod
    def _find_text(cls, value: object) -> str:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, Mapping):
            for key in ("text", "transcript", "output_text", "content"):
                candidate = value.get(key)
                if isinstance(candidate, str) and candidate.strip():
                    return candidate.strip()
            for candidate in value.values():
                result = cls._find_text(candidate)
                if result:
                    return result
        if isinstance(value, list):
            return "".join(cls._find_text(item) for item in value).strip()
        return ""

    @staticmethod
    def _find_number(value: object, keys: tuple[str, ...]) -> int:
        if isinstance(value, Mapping):
            for key in keys:
                candidate = value.get(key)
                if isinstance(candidate, (int, float)):
                    return max(0, int(candidate))
            for candidate in value.values():
                result = StepFunSpeechProvider._find_number(candidate, keys)
                if result:
                    return result
        if isinstance(value, list):
            for item in value:
                result = StepFunSpeechProvider._find_number(item, keys)
                if result:
                    return result
        return 0
