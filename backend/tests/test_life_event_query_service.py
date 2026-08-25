"""Unit tests for the life-event query application service."""

import unittest
from unittest.mock import Mock

from services.life_event_query_service import LifeEventQueryService
from tools.sql_tool import SQLTool


class LifeEventQueryServiceTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.sql_tool = Mock(spec=SQLTool)
        self.service = LifeEventQueryService(self.sql_tool)

    def test_normalizes_user_id_and_delegates_to_sql_tool(self) -> None:
        expected = [{"life_event_id": 1}]
        self.sql_tool.get_recent_events.return_value = expected

        result = self.service.get_recent_events(" 10001 ", 14)

        self.assertIs(result, expected)
        self.sql_tool.get_recent_events.assert_called_once_with("10001", days=14)

    def test_rejects_blank_user_id(self) -> None:
        with self.assertRaisesRegex(ValueError, "user_id is required"):
            self.service.get_recent_events("  ", 7)
        self.sql_tool.get_recent_events.assert_not_called()

    def test_rejects_days_outside_supported_range(self) -> None:
        for days in (0, 31):
            with self.subTest(days=days):
                with self.assertRaisesRegex(ValueError, "between 1 and 30"):
                    self.service.get_recent_events("10001", days)
        self.sql_tool.get_recent_events.assert_not_called()


if __name__ == "__main__":
    unittest.main()
