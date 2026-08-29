"""HTTP adapter for the StepFun streaming speech recognition endpoint."""

from __future__ import annotations

import base64
from collections.abc import Mapping
from io import BytesIO
import json
import re
import wave
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class SpeechProviderError(RuntimeError):
    """Raised when the external transcription service cannot be used."""


SUPPORTED_AUDIO_FORMATS = frozenset({"ogg", "mp3", "wav", "pcm", "m4a", "webm"})
_EXTENSION_FORMATS = {
    "ogg": "ogg",
    "oga": "ogg",
    "opus": "ogg",
    "mp3": "mp3",
    "wav": "wav",
    "pcm": "pcm",
    "raw": "pcm",
    "m4a": "m4a",
    "webm": "webm",
}
_CONTENT_TYPE_FORMATS = {
    "audio/ogg": "ogg",
    "application/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/pcm": "pcm",
    "audio/l16": "pcm",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/webm": "webm",
    "video/webm": "webm",
}


def infer_audio_format(filename: str, content_type: str) -> str | None:
    """Return a StepFun format from upload metadata, or None when unsupported."""

    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
    normalized_name = (filename or "").split("?", 1)[0].rsplit("/", 1)[-1].lower()
    extension_match = re.search(r"\.([a-z0-9]+)$", normalized_name)
    if extension_match:
        extension_format = _EXTENSION_FORMATS.get(extension_match.group(1))
        if extension_format:
            return extension_format
    return _CONTENT_TYPE_FORMATS.get(normalized_type)


def _stepfun_language(language: str) -> str:
    normalized = (language or "zh-CN").strip().replace("_", "-")
    if not normalized:
        return "zh"
    return normalized.split("-", 1)[0].lower()


def _wav_format(audio: bytes) -> dict[str, int | str]:
    """Read optional WAV metadata so the provider gets an accurate format."""

    try:
        with wave.open(BytesIO(audio), "rb") as wav_file:
            return {
                "type": "wav",
                "rate": wav_file.getframerate(),
                "bits": wav_file.getsampwidth() * 8,
                "channel": wav_file.getnchannels(),
            }
    except (EOFError, OSError, wave.Error):
        return {"type": "wav"}


class StepFunSpeechProvider:
    def __init__(self, base_url: str, api_key: str, model: str, timeout: float = 60.0) -> None:
        if not base_url or not api_key or not model:
            raise ValueError("speech provider configuration is incomplete")
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._timeout = timeout

    def transcribe(self, audio: bytes, filename: str, content_type: str, language: str) -> dict[str, object]:
        audio_format = infer_audio_format(filename, content_type)
        if audio_format not in SUPPORTED_AUDIO_FORMATS:
            raise SpeechProviderError("unsupported audio format")

        format_payload: dict[str, int | str] = (
            _wav_format(audio) if audio_format == "wav" else {"type": audio_format}
        )
        if audio_format == "pcm":
            format_payload.update({"codec": "pcm_s16le", "rate": 16000, "bits": 16, "channel": 1})

        body = {
            "audio": {
                "data": base64.b64encode(audio).decode("ascii"),
                "input": {
                    "transcription": {
                        "language": _stepfun_language(language),
                        "model": self._model,
                        "enable_itn": True,
                    },
                    "format": format_payload,
                },
            }
        }
        request = Request(
            self._base_url,
            data=json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
        )
        try:
            with urlopen(request, timeout=self._timeout) as response:  # noqa: S310 - URL is configured by the operator.
                payload = response.read().decode("utf-8", errors="replace")
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise SpeechProviderError("speech provider request failed") from exc

        parsed = self._parse_response(payload)
        text, duration_ms = self._extract_transcription(parsed)
        if not text:
            raise SpeechProviderError("speech provider returned no transcription")
        return {"text": text, "language": language or "zh-CN", "duration_ms": duration_ms}

    @staticmethod
    def _parse_response(payload: str) -> object:
        """Parse either a JSON response or the JSON data frames in an SSE stream."""

        stripped = payload.strip()
        if stripped:
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass

        events: list[object] = []
        pending_data: list[str] = []

        def flush_pending() -> None:
            if not pending_data:
                return
            value = "\n".join(pending_data).strip()
            pending_data.clear()
            if not value or value == "[DONE]":
                return
            try:
                events.append(json.loads(value))
            except json.JSONDecodeError:
                events.append({"text": value})

        for line in payload.splitlines():
            if line.startswith("data:"):
                value = line[5:].lstrip()
                # StepFun emits one JSON object per data frame. Keeping a
                # non-JSON line pending also supports standard multi-line SSE.
                if pending_data and value.startswith("{"):
                    flush_pending()
                if value == "[DONE]":
                    flush_pending()
                else:
                    try:
                        events.append(json.loads(value))
                    except json.JSONDecodeError:
                        pending_data.append(value)
            elif not line.strip():
                flush_pending()
        flush_pending()
        return events

    @classmethod
    def _extract_transcription(cls, value: object) -> tuple[str, int]:
        """Prefer the authoritative done frame and avoid delta duplication."""

        events = value if isinstance(value, list) else [value]
        deltas: list[str] = []
        done_text = ""
        duration_ms = 0
        for event in events:
            if not isinstance(event, Mapping):
                continue
            event_type = event.get("type")
            if event_type == "error":
                raise SpeechProviderError("speech provider returned an error")
            if event_type == "transcript.text.delta":
                delta = event.get("delta")
                if isinstance(delta, str):
                    deltas.append(delta)
                end_time = event.get("end_time")
                if isinstance(end_time, (int, float)):
                    duration_ms = max(duration_ms, int(end_time))
            elif event_type == "transcript.text.done":
                text = event.get("text")
                if isinstance(text, str):
                    done_text = text.strip()
            duration_ms = max(duration_ms, cls._find_number(event, ("duration_ms", "durationMillis")))

        text = done_text or "".join(deltas).strip()
        if not text:
            text = cls._find_text(value)
        return text.strip(), duration_ms

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

    @classmethod
    def _find_number(cls, value: object, keys: tuple[str, ...]) -> int:
        if isinstance(value, Mapping):
            for key in keys:
                candidate = value.get(key)
                if isinstance(candidate, (int, float)):
                    return max(0, int(candidate))
            for candidate in value.values():
                result = cls._find_number(candidate, keys)
                if result:
                    return result
        if isinstance(value, list):
            for item in value:
                result = cls._find_number(item, keys)
                if result:
                    return result
        return 0
