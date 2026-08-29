from __future__ import annotations

import unittest
from datetime import date

from services.weekly_poster import WeeklyPosterService


class WeeklyPosterServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.service = WeeklyPosterService()

    def test_render_poster_escapes_user_content_and_uses_fixed_canvas(self) -> None:
        svg = self.service.render_poster(
            {
                "week_start": date(2026, 8, 18),
                "week_end": date(2026, 8, 24),
                "report_data": {
                    "overview": {
                        "title": '周报 <script>alert("x")</script>',
                        "theme": "主主题",
                        "summary": '总结里带 <b>标签</b>',
                    },
                    "activity_analysis": {
                        "total_events": 2,
                        "summary": "时间结构概览",
                        "trend_summary": "节奏稳定",
                        "category_distribution": [
                            {
                                "category": "study",
                                "category_label": "学习",
                                "count": 2,
                                "share": 100.0,
                            }
                        ],
                        "time_bands": {
                            "morning": 1,
                            "afternoon": 1,
                            "evening": 0,
                            "night": 0,
                        },
                    },
                    "section_reviews": [
                        {
                            "title": "工作与学习",
                            "summary": "关注 <img src=x onerror=alert(1)>",
                            "points": ["要点 <1>", "要点 2"],
                        }
                    ],
                    "highlights": [
                        {
                            "title": "高光 <tag>",
                            "summary": "内容 <more>",
                        }
                    ],
                    "completion": {
                        "completed": ["A"],
                        "unfinished": ["B"],
                        "summary": "完成情况 <ok>",
                    },
                    "next_week_suggestions": ["建议 <keep>"],
                },
            }
        )

        self.assertIn('width="1080"', svg)
        self.assertIn('height="1080"', svg)
        self.assertIn('viewBox="0 0 1080 1080"', svg)
        self.assertIn("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;", svg)
        self.assertIn("&lt;img src=x onerror=alert(1)&gt;", svg)
        self.assertNotIn("<script>alert", svg)

    def test_render_empty_state_poster(self) -> None:
        svg = self.service.render_poster(
            {
                "week_start": date(2026, 8, 18),
                "week_end": date(2026, 8, 24),
                "report_data": {
                    "overview": {
                        "title": "空状态周报",
                        "theme": "无事件",
                        "summary": "本周没有记录",
                    },
                    "activity_analysis": {"total_events": 0},
                    "section_reviews": [],
                    "highlights": [],
                    "completion": {},
                    "next_week_suggestions": ["先补一条记录"],
                },
            }
        )

        self.assertIn("本周还没有记录", svg)
        self.assertIn("先补一条记录", svg)


if __name__ == "__main__":
    unittest.main()
