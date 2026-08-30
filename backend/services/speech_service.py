"""Speech validation and provider orchestration."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import wave

from core.providers.stepfun_speech_provider import SpeechProviderError, StepFunSpeechProvider, infer_audio_format
from core.settings import load_settings


class SpeechServiceError(RuntimeError):
    def __init__(self, error_code: str, message: str) -> None:
        super().__init__(message)
        self.error_code = error_code
        self.message = message


@dataclass(frozen=True)
class SpeechResult:
    text: str
    language: str
    duration_ms: int


class SpeechService:
    max_audio_bytes = 10 * 1024 * 1024
    max_duration_ms = 60_000

    def __init__(self, provider: StepFunSpeechProvider | None) -> None:
        self._provider = provider

    @classmethod
    def from_environment(cls) -> "SpeechService":
        settings = load_settings()
        if not settings.speech_to_text_base_url or not settings.speech_to_text_api_key:
            return cls(None)
        return cls(StepFunSpeechProvider(settings.speech_to_text_base_url, settings.speech_to_text_api_key, settings.speech_to_text_model, settings.speech_to_text_timeout))

    def transcribe(self, audio: bytes, filename: str, content_type: str, language: str) -> SpeechResult:
        if not audio:
            raise SpeechServiceError("AUDIO_EMPTY", "音频不能为空")
        if len(audio) > self.max_audio_bytes:
            raise SpeechServiceError("AUDIO_TOO_LARGE", "音频超过 10 MB 限制")
        if infer_audio_format(filename, content_type or "application/octet-stream") is None:
            raise SpeechServiceError("INVALID_AUDIO", "音频格式不受支持")
        local_duration_ms = self._wav_duration_ms(audio, filename, content_type)
        if local_duration_ms > self.max_duration_ms:
            raise SpeechServiceError("AUDIO_TOO_LARGE", "音频最长不能超过 60 秒")
        if self._provider is None:
            raise SpeechServiceError("TRANSCRIPTION_UNAVAILABLE", "语音服务暂时不可用")
        try:
            result = self._provider.transcribe(audio, filename, content_type or "application/octet-stream", language)
        except SpeechProviderError as exc:
            raise SpeechServiceError("TRANSCRIPTION_UNAVAILABLE", "语音服务暂时不可用") from exc
        duration_ms = int(result.get("duration_ms", 0)) or local_duration_ms
        if duration_ms > self.max_duration_ms:
            raise SpeechServiceError("AUDIO_TOO_LARGE", "音频最长不能超过 60 秒")
        text = str(result.get("text", "")).strip()
        if not text:
            raise SpeechServiceError("TRANSCRIPTION_UNAVAILABLE", "没有识别到有效语音")
        return SpeechResult(text=text, language=str(result.get("language", language)), duration_ms=duration_ms)

    @staticmethod
    def _wav_duration_ms(audio: bytes, filename: str, content_type: str) -> int:
        if infer_audio_format(filename, content_type) != "wav":
            return 0
        try:
            with wave.open(BytesIO(audio), "rb") as wav_file:
                frame_rate = wav_file.getframerate()
                if frame_rate <= 0:
                    return 0
                return int(wav_file.getnframes() * 1000 / frame_rate)
        except (EOFError, OSError, wave.Error):
            return 0
