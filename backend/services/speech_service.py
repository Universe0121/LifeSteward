"""Speech validation and provider orchestration."""

import io
import wave

from core.providers.speech_provider import SpeechProvider, SpeechProviderError, SpeechProviderUnavailable, Transcription

MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_DURATION_MS = 60_000
SUPPORTED_AUDIO_TYPES = {
    "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/wave",
    "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/3gpp",
}


class SpeechServiceError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code, self.status_code = code, status_code


class SpeechService:
    def __init__(self, provider: SpeechProvider) -> None:
        self.provider = provider

    def transcribe(self, audio: bytes, *, user_id: int | None = None, filename: str = "audio", content_type: str = "application/octet-stream", language: str = "zh-CN") -> Transcription:
        del user_id
        if not audio:
            raise SpeechServiceError("INVALID_AUDIO", "音频文件无效", 400)
        normalized_type = content_type.split(";", 1)[0].strip().lower()
        if normalized_type not in SUPPORTED_AUDIO_TYPES:
            raise SpeechServiceError("INVALID_AUDIO", "不支持的音频格式", 400)
        if len(audio) > MAX_AUDIO_BYTES:
            raise SpeechServiceError("AUDIO_TOO_LARGE", "音频文件不能超过 10 MB", 413)
        duration_ms = self._wav_duration_ms(audio) if normalized_type in {"audio/wav", "audio/x-wav", "audio/wave"} or filename.lower().endswith(".wav") else 0
        if duration_ms > MAX_DURATION_MS:
            raise SpeechServiceError("INVALID_AUDIO", "音频时长不能超过 60 秒", 400)
        try:
            result = self.provider.transcribe(audio, filename=filename, content_type=content_type, language=language or "zh-CN")
        except SpeechProviderUnavailable as exc:
            raise SpeechServiceError("TRANSCRIPTION_UNAVAILABLE", "语音转写服务暂时不可用", 503) from exc
        except SpeechProviderError as exc:
            raise SpeechServiceError("TRANSCRIPTION_UNAVAILABLE", "语音转写服务暂时不可用", 503) from exc
        if result.duration_ms > MAX_DURATION_MS:
            raise SpeechServiceError("INVALID_AUDIO", "音频时长不能超过 60 秒", 400)
        return result

    @staticmethod
    def _wav_duration_ms(audio: bytes) -> int:
        try:
            with wave.open(io.BytesIO(audio)) as wav:
                return int(wav.getnframes() / wav.getframerate() * 1000) if wav.getframerate() else 0
        except (wave.Error, EOFError, OSError):
            raise SpeechServiceError("INVALID_AUDIO", "音频文件无效", 400)
