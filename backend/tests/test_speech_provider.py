import io
import json
import unittest
import wave
from unittest.mock import patch

from core.providers.speech_provider import HttpSpeechProvider


class FakeHTTPResponse:
    def __init__(self, body: bytes) -> None:
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self) -> bytes:
        return self.body


def wav_bytes() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16_000)
        wav.writeframes(b"\0\0" * 160)
    return output.getvalue()


class SpeechProviderTest(unittest.TestCase):
    def test_stepfun_sse_uses_json_base64_and_collects_transcript(self) -> None:
        body = 'data: {"type":"transcript.text.delta","text":"你好"}\n\ndata: {"type":"transcript.text.done","text":""}\n\n'.encode()
        with patch("core.providers.speech_provider.urllib.request.urlopen", return_value=FakeHTTPResponse(body)) as open_url:
            result = HttpSpeechProvider(
                "https://api.stepfun.com/v1/audio/asr/sse", "secret", "stepaudio-2.5-asr"
            ).transcribe(wav_bytes(), filename="voice.wav", content_type="audio/wav", language="zh-CN")

        request = open_url.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.stepfun.com/v1/audio/asr/sse")
        self.assertEqual(request.headers["Content-type"], "application/json")
        payload = json.loads(request.data)
        self.assertEqual(payload["audio"]["input"]["transcription"]["language"], "zh")
        self.assertEqual(payload["audio"]["input"]["transcription"]["model"], "stepaudio-2.5-asr")
        self.assertEqual(payload["audio"]["input"]["format"]["type"], "wav")
        self.assertEqual(result.text, "你好")


if __name__ == "__main__":
    unittest.main()
