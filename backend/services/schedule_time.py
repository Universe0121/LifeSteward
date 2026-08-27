"""Deterministic parsing for the small Chinese schedule syntax we support."""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")
_CHINESE_NUMBERS = {
    "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3,
    "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
}


def _chinese_hour(value: str) -> int | None:
    if value.isdigit():
        return int(value)
    if value == "十":
        return 10
    if len(value) == 2 and value[0] == "十":
        return 10 + _CHINESE_NUMBERS.get(value[1], 0)
    if len(value) == 2 and value[1] == "十":
        return _CHINESE_NUMBERS.get(value[0], 0) * 10
    if len(value) == 3 and value[1] == "十":
        return _CHINESE_NUMBERS.get(value[0], 0) * 10 + _CHINESE_NUMBERS.get(value[2], 0)
    return _CHINESE_NUMBERS.get(value)


def parse_advance_minutes(text: str) -> int | None:
    content = str(text)
    if "提前半小时" in content:
        return 30
    minutes = re.search(r"提前\s*(\d+)\s*分钟", content)
    if minutes:
        return int(minutes.group(1))
    hours = re.search(r"提前\s*(\d+(?:\.\d+)?)\s*小时", content)
    if hours:
        return int(float(hours.group(1)) * 60)
    return None


def parse_chinese_datetime(
    text: str,
    now: datetime | None = None,
) -> datetime | None:
    content = str(text)
    reference = now or datetime.now(SHANGHAI)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=SHANGHAI)
    else:
        reference = reference.astimezone(SHANGHAI)

    day_offset = 0
    for marker, offset in (("后天", 2), ("明天", 1), ("今天", 0)):
        if marker in content:
            day_offset = offset
            break

    match = re.search(r"(上午|早上|中午|下午|晚上|今晚)?\s*(\d{1,2})(?::(\d{2}))", content)
    if match:
        period, hour_text, minute_text = match.groups()
        hour, minute = int(hour_text), int(minute_text)
    else:
        match = re.search(
            r"(上午|早上|中午|下午|晚上|今晚)?\s*([零〇一二两三四五六七八九十\d]{1,3})点(半|([零〇一二两三四五六七八九十\d]{1,2})分)?",
            content,
        )
        if not match:
            return None
        period, hour_text, half_or_minutes, minute_text = match.groups()
        hour = _chinese_hour(hour_text)
        if hour is None:
            return None
        minute = 30 if half_or_minutes == "半" else (_chinese_hour(minute_text or "零") or 0)

    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        return None
    if period in {"下午", "晚上", "今晚"} and hour < 12:
        hour += 12
    if period == "中午" and hour < 11:
        hour += 12
    target_date = reference.date() + timedelta(days=day_offset)
    return datetime(target_date.year, target_date.month, target_date.day, hour, minute, tzinfo=SHANGHAI)
