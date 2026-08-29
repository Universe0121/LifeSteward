from __future__ import annotations

import json
import unittest
from collections import deque
from collections.abc import Mapping
from typing import Any

from agents.weekly_report_agent import WeeklyReportAgent
from core.llm_service import LLMService


class QueueLLMService(LLMService):
    def __init__(self, responses: list[str | Exception]) -> None:
        self._responses = deque(responses)
        self.calls: list[dict[str, Any]] = []

    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        self.calls.append({"prompt": prompt, "variables": dict(variables)})
        response = self._responses.popleft()
        if isinstance(response, Exception):
            raise response
        return response


def build_events() -> list[dict[str, Any]]:
    return [
        {
            "life_event_id": 1,
            "event_type": "study",
            "event_content": "学习数学 2 小时",
            "event_time": "2026-08-18T09:00:00+08:00",
            "emotion": "focused",
            "importance_score": 0.9,
            "source_text": "学习数学 2 小时",
        },
        {
            "life_event_id": 2,
            "event_type": "work",
            "event_content": "处理项目需求评审",
            "event_time": "2026-08-18T14:00:00+08:00",
            "emotion": "busy",
            "importance_score": 0.8,
            "source_text": "处理项目需求评审",
        },
        {
            "life_event_id": 3,
            "event_type": "sleep",
            "event_content": "昨晚睡了 6 小时",
            "event_time": "2026-08-19T23:30:00+08:00",
            "emotion": "tired",
            "importance_score": 0.7,
            "source_text": "昨晚睡了 6 小时",
        },
        {
            "life_event_id": 4,
            "event_type": "social",
            "event_content": "和朋友吃饭聊天",
            "event_time": "2026-08-20T19:30:00+08:00",
            "emotion": "happy",
            "importance_score": 0.6,
            "source_text": "和朋友吃饭聊天",
        },
        {
            "life_event_id": 5,
            "event_type": "creative",
            "event_content": "整理周报草稿",
            "event_time": "2026-08-21T21:00:00+08:00",
            "emotion": "calm",
            "importance_score": 0.95,
            "source_text": "整理周报草稿",
        },
        {
            "life_event_id": 6,
            "event_type": "exercise",
            "event_content": "晚饭后散步 30 分钟",
            "event_time": "2026-08-22T20:00:00+08:00",
            "emotion": "relaxed",
            "importance_score": 0.5,
            "source_text": "晚饭后散步 30 分钟",
        },
    ]


class WeeklyReportAgentTest(unittest.TestCase):
    def test_generate_merges_model_text_and_computed_stats(self) -> None:
        llm_service = QueueLLMService(
            [
                json.dumps(
                    {
                        "overview": {
                            "title": "LLM 标题",
                            "theme": "LLM 主题",
                            "summary": "LLM 总述",
                        },
                        "activity_analysis": {
                            "summary": "LLM 时间结构总结",
                            "trend_summary": "LLM 趋势",
                            "comparison_note": "LLM 补充说明",
                        },
                        "section_reviews": [
                            {
                                "title": "健康与自律",
                                "summary": "LLM 健康回顾",
                                "points": ["A", "B", "C", "D", "E"],
                            }
                        ],
                        "highlights": [
                            {
                                "title": "LLM 高光 1",
                                "summary": "LLM 高光摘要",
                            }
                            for _ in range(6)
                        ],
                        "completion": {
                            "completed": ["LLM"],
                            "unfinished": ["LLM"],
                            "summary": "LLM 完成度",
                        },
                        "next_week_suggestions": ["A", "B", "C", "D"],
                    },
                    ensure_ascii=False,
                )
            ]
        )

        agent = WeeklyReportAgent(llm_service=llm_service)
        result = agent.generate(
            "10001",
            "2026-08-17",
            "2026-08-23",
            build_events(),
            {"sleep_habit": "late"},
        )

        self.assertEqual(result["overview"]["theme"], "LLM 主题")
        self.assertEqual(result["overview"]["summary"], "LLM 总述")
        self.assertEqual(result["activity_analysis"]["total_events"], 6)
        self.assertEqual(result["activity_analysis"]["dominant_category"], "study")
        self.assertEqual(len(result["section_reviews"]), 5)
        self.assertLessEqual(len(result["highlights"]), 5)
        self.assertLessEqual(len(result["next_week_suggestions"]), 3)
        self.assertEqual(result["highlights"][0]["event_ids"], [5])
        self.assertEqual(result["completion"]["summary"], "LLM 完成度")
        self.assertIn("computed_report", llm_service.calls[0]["variables"])
        self.assertEqual(llm_service.calls[0]["variables"]["user_id"], "10001")

    def test_invalid_json_falls_back_to_computed_report(self) -> None:
        llm_service = QueueLLMService(["not json"])
        agent = WeeklyReportAgent(llm_service=llm_service)

        result = agent.generate("10001", "2026-08-17", "2026-08-23", build_events())

        self.assertEqual(result["overview"]["summary"], "本周共记录 6 条事件，重心主要在 学习，其余节奏相对分散。")
        self.assertEqual(result["activity_analysis"]["total_events"], 6)
        self.assertLessEqual(len(result["next_week_suggestions"]), 3)
        self.assertTrue(all(isinstance(item, str) and item.strip() for item in result["next_week_suggestions"]))

    def test_empty_events_returns_empty_state_without_llm_call(self) -> None:
        llm_service = QueueLLMService([])
        agent = WeeklyReportAgent(llm_service=llm_service)

        result = agent.generate("10001", "2026-08-17", "2026-08-23", [])

        self.assertEqual(result["activity_analysis"]["total_events"], 0)
        self.assertEqual(result["highlights"], [])
        self.assertEqual(result["next_week_suggestions"], [
            "先记录一条日常事件，给周报留下一点骨架。",
            "把睡眠、工作或学习里的一个片段写完整。",
            "尽量保留时间、地点和感受，后面更好回顾。",
        ])
        self.assertEqual(llm_service.calls, [])

    def test_timeout_falls_back_to_computed_report(self) -> None:
        llm_service = QueueLLMService([TimeoutError("timeout")])
        agent = WeeklyReportAgent(llm_service=llm_service)

        result = agent.generate("10001", "2026-08-17", "2026-08-23", build_events())

        self.assertEqual(result["activity_analysis"]["total_events"], 6)
        self.assertEqual(len(result["highlights"]), 5)


if __name__ == "__main__":
    unittest.main()
