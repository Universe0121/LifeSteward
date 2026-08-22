"""Retry and timeout tests for the Qwen provider boundary."""

from __future__ import annotations

import unittest

from core.llm_service import LLMResponseError, LLMTimeoutError
from core.providers.qwen_provider import QwenProvider


class SequenceCompletions:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    def create(self, **kwargs):
        self.calls += 1
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class FakeClient:
    def __init__(self, responses):
        from types import SimpleNamespace

        self.completions = SequenceCompletions(responses)
        self.chat = SimpleNamespace(completions=self.completions)


class LLMRetryTest(unittest.TestCase):
    def test_first_failure_then_success_retries(self) -> None:
        client = FakeClient([RuntimeError("temporary"), "success"])
        provider = QwenProvider(
            api_key="test-key",
            client=client,
            max_retries=2,
            retry_backoff=0,
        )

        self.assertEqual(provider.generate("prompt", {}), "success")
        self.assertEqual(client.completions.calls, 2)

    def test_continuous_failure_raises_after_retry_limit(self) -> None:
        client = FakeClient([RuntimeError("failed")] * 4)
        provider = QwenProvider(
            api_key="test-key",
            client=client,
            max_retries=3,
            retry_backoff=0,
        )

        with self.assertRaisesRegex(LLMResponseError, "4 attempts"):
            provider.generate("prompt", {})
        self.assertEqual(client.completions.calls, 4)

    def test_timeout_raises_explicit_timeout_error(self) -> None:
        client = FakeClient([TimeoutError("timed out")] * 3)
        provider = QwenProvider(
            api_key="test-key",
            client=client,
            max_retries=2,
            retry_backoff=0,
        )

        with self.assertRaises(LLMTimeoutError):
            provider.generate("prompt", {})
        self.assertEqual(client.completions.calls, 3)

    def test_html_response_is_retried_and_reported(self) -> None:
        client = FakeClient(["<html>bad gateway</html>"] * 2)
        provider = QwenProvider(
            api_key="test-key",
            client=client,
            max_retries=1,
            retry_backoff=0,
        )

        with self.assertRaisesRegex(LLMResponseError, "API path"):
            provider.generate("prompt", {})
        self.assertEqual(client.completions.calls, 2)


if __name__ == "__main__":
    unittest.main()
