"""Tests for deterministic Chinese schedule time parsing."""

import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

from services.schedule_time import parse_advance_minutes, parse_chinese_datetime


class ScheduleTimeTest(unittest.TestCase):
    now = datetime(2026, 8, 27, 10, 0, tzinfo=ZoneInfo("Asia/Shanghai"))

    def test_parses_tomorrow_afternoon_three(self) -> None:
        result = parse_chinese_datetime("明天下午三点有组会", now=self.now)

        self.assertEqual(result, datetime(2026, 8, 28, 15, 0, tzinfo=ZoneInfo("Asia/Shanghai")))

    def test_parses_numeric_time(self) -> None:
        result = parse_chinese_datetime("明天15:00开会", now=self.now)

        self.assertEqual(result, datetime(2026, 8, 28, 15, 0, tzinfo=ZoneInfo("Asia/Shanghai")))

    def test_parses_advance_minutes(self) -> None:
        self.assertEqual(parse_advance_minutes("提醒我提前半小时准备"), 30)
        self.assertEqual(parse_advance_minutes("提前45分钟提醒我"), 45)

    def test_invalid_time_returns_none(self) -> None:
        self.assertIsNone(parse_chinese_datetime("以后有空再开会", now=self.now))
        self.assertIsNone(parse_advance_minutes("提醒我一下"))


if __name__ == "__main__":
    unittest.main()
