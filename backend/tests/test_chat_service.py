"""Day1 tests for the chat schema and service layer."""

import unittest

from pydantic import ValidationError

from schemas.chat_schema import ChatRequest, ChatResponse
from services.chat_service import process_chat_message


class ChatServiceTestCase(unittest.TestCase):
    """Verify the Day1 chat contract."""

    def setUp(self) -> None:
        self.chat_request = ChatRequest(
            user_id=10001,
            conversation_id="conv001",
            user_input="今天学习数学2小时",
        )

    def test_chat_request_accepts_required_fields(self) -> None:
        self.assertEqual(self.chat_request.user_id, 10001)
        self.assertEqual(self.chat_request.conversation_id, "conv001")
        self.assertEqual(self.chat_request.user_input, "今天学习数学2小时")

    def test_chat_request_rejects_unconfirmed_fields(self) -> None:
        with self.assertRaises(ValidationError):
            ChatRequest(
                user_id=10001,
                conversation_id="conv001",
                user_input="今天学习数学2小时",
                extra_field="not_allowed",
            )

    def test_chat_request_requires_all_fields(self) -> None:
        with self.assertRaises(ValidationError):
            ChatRequest(
                user_id=10001,
                conversation_id="conv001",
            )

    def test_process_chat_message_returns_chat_response(self) -> None:
        chat_response = process_chat_message(self.chat_request)

        self.assertIsInstance(chat_response, ChatResponse)
        self.assertEqual(chat_response.assistant_response, "")
        self.assertEqual(chat_response.intent, "")
        self.assertEqual(chat_response.extracted_events, [])

    def test_chat_response_has_only_public_contract_fields(self) -> None:
        chat_response = process_chat_message(self.chat_request)

        response_data = (
            chat_response.model_dump()
            if hasattr(chat_response, "model_dump")
            else chat_response.dict()
        )
        self.assertEqual(
            set(response_data.keys()),
            {"assistant_response", "intent", "extracted_events"},
        )


if __name__ == "__main__":
    unittest.main()

