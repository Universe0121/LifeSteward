"""Provider adapters for the LifeAgent backend."""

from core.providers.qwen_provider import (
    DASHSCOPE_COMPATIBLE_BASE_URL,
    QwenProvider,
)
from core.providers.speech_provider import (
    HttpSpeechProvider,
    SpeechProvider,
    SpeechProviderError,
    SpeechProviderUnavailable,
    Transcription,
    UnconfiguredSpeechProvider,
)

__all__ = [
    "DASHSCOPE_COMPATIBLE_BASE_URL",
    "QwenProvider",
    "HttpSpeechProvider",
    "SpeechProvider",
    "SpeechProviderError",
    "SpeechProviderUnavailable",
    "Transcription",
    "UnconfiguredSpeechProvider",
]
