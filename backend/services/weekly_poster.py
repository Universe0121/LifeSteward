"""Deterministic SVG poster renderer for weekly reports."""

from __future__ import annotations

import html
import textwrap
from collections.abc import Mapping, Sequence
from datetime import date, datetime
from typing import Any


class WeeklyPosterService:
    WIDTH = 1080
    HEIGHT = 1080
    LEFT_X = 48
    RIGHT_X = 556
    TOP_Y = 48
    HEADER_H = 92
    PANEL_Y = 160
    PANEL_H = 700
    PANEL_W = 476
    PANEL_GAP = 32
    FOOTER_Y = 892
    FOOTER_H = 140
    INNER_PAD = 28

    _DEFAULT_SECTION_TITLES = (
        "健康与自律",
        "工作与学习",
        "创作与分享",
        "社交与娱乐",
        "生活记录",
    )

    _CATEGORY_COLORS = {
        "sleep": "#4C78A8",
        "work": "#F28E2B",
        "study": "#59A14F",
        "exercise": "#E15759",
        "meal": "#EDC948",
        "social": "#B07AA1",
        "creative": "#76B7B2",
        "entertainment": "#FF9DA7",
        "chores": "#9C755F",
        "health": "#86BCB6",
        "other": "#7F8C99",
    }

    def render_poster(self, report: Mapping[str, Any]) -> str:
        payload = self._extract_payload(report)
        metadata = self._extract_metadata(report)
        overview = self._mapping(payload.get("overview"))
        activity = self._mapping(payload.get("activity_analysis") or payload.get("stats"))
        section_reviews = self._section_reviews(payload.get("section_reviews"))
        highlights = self._list_of_mappings(payload.get("highlights"))
        completion = self._mapping(payload.get("completion"))
        suggestions = self._string_list(
            payload.get("next_week_suggestions") or payload.get("suggestions")
        )

        title = self._text(
            overview.get("title")
            or f"{metadata['week_start']} 至 {metadata['week_end']} 周报"
        )
        theme = self._text(overview.get("theme") or "本周主题未填写")
        summary = self._text(overview.get("summary") or payload.get("summary") or "本周还没有可展示的摘要。")
        week_label = self._text(f"{metadata['week_start']} - {metadata['week_end']}")
        total_events = self._int(activity.get("total_events"))
        completion_rate = self._completion_rate(completion)

        distributions = self._category_distribution(activity, total_events)
        time_bands = self._time_bands(activity)
        reviews = self._normalize_reviews(section_reviews)
        highlights = self._normalize_highlights(highlights)
        suggestions = suggestions[:3]

        if total_events <= 0:
            left_panel = self._render_empty_left_panel(theme, summary)
        else:
            left_panel = self._render_activity_left_panel(
                total_events,
                activity,
                distributions,
                time_bands,
            )

        right_panel = self._render_right_panel(
            reviews,
            highlights,
            suggestions,
        )
        footer = self._render_footer(theme, completion_rate, metadata)

        return (
            '<?xml version="1.0" encoding="UTF-8"?>'
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{self.WIDTH}" height="{self.HEIGHT}" '
            f'viewBox="0 0 {self.WIDTH} {self.HEIGHT}" '
            'role="img" aria-label="LifeAgent weekly report poster">'
            f"<title>{self._escape(title)}</title>"
            f"<desc>{self._escape(summary)}</desc>"
            f'<rect width="{self.WIDTH}" height="{self.HEIGHT}" fill="#F6F8FC"/>'
            f'{self._header(title, theme, week_label)}'
            f'{left_panel}'
            f'{right_panel}'
            f'{footer}'
            "</svg>"
        )

    def _header(self, title: str, theme: str, week_label: str) -> str:
        return (
            f'<g>'
            f'<text x="{self.LEFT_X}" y="94" font-size="38" font-weight="700" fill="#101828" '
            f'font-family="Arial, sans-serif">{self._escape(title)}</text>'
            f'<text x="{self.LEFT_X}" y="126" font-size="16" fill="#667085" '
            f'font-family="Arial, sans-serif">{self._escape(theme)}</text>'
            f'<rect x="860" y="58" width="172" height="42" rx="21" fill="#111827"/>'
            f'<text x="946" y="85" text-anchor="middle" font-size="14" font-weight="700" '
            f'fill="#FFFFFF" font-family="Arial, sans-serif">LifeAgent</text>'
            f'<text x="1032" y="126" text-anchor="end" font-size="16" fill="#667085" '
            f'font-family="Arial, sans-serif">{self._escape(week_label)}</text>'
            f'</g>'
        )

    def _render_activity_left_panel(
        self,
        total_events: int,
        activity: Mapping[str, Any],
        distributions: list[dict[str, Any]],
        time_bands: dict[str, int],
    ) -> str:
        summary = self._text(
            activity.get("summary")
            or "本周的活动结构已经整理好。"
        )
        trend = self._text(activity.get("trend_summary") or "")
        dominant = self._text(activity.get("dominant_category_label") or "")

        bars = self._render_category_bar(distributions)
        legend = self._render_category_legend(distributions)
        time_panel = self._render_time_bands(time_bands)

        return (
            f'<g>'
            f'{self._panel_shell(self.LEFT_X, self.PANEL_Y, self.PANEL_W, self.PANEL_H)}'
            f'<text x="{self.LEFT_X + self.INNER_PAD}" y="202" font-size="24" font-weight="700" '
            f'fill="#101828" font-family="Arial, sans-serif">活动结构</text>'
            f'<text x="{self.LEFT_X + self.INNER_PAD}" y="228" font-size="13" fill="#667085" '
            f'font-family="Arial, sans-serif">{self._escape(summary)}</text>'
            f'<text x="{self.LEFT_X + self.INNER_PAD}" y="252" font-size="13" fill="#475467" '
            f'font-family="Arial, sans-serif">{self._escape(dominant or f"共 {total_events} 条记录")}</text>'
            f'{bars}'
            f'{legend}'
            f'{time_panel}'
            f'<text x="{self.LEFT_X + self.INNER_PAD}" y="836" font-size="13" fill="#667085" '
            f'font-family="Arial, sans-serif">{self._escape(trend)}</text>'
            f'</g>'
        )

    def _render_empty_left_panel(self, theme: str, summary: str) -> str:
        return (
            f'<g>'
            f'{self._panel_shell(self.LEFT_X, self.PANEL_Y, self.PANEL_W, self.PANEL_H)}'
            f'<text x="{self.LEFT_X + self.INNER_PAD}" y="202" font-size="24" font-weight="700" '
            f'fill="#101828" font-family="Arial, sans-serif">活动结构</text>'
            f'<text x="{self.LEFT_X + self.INNER_PAD}" y="240" font-size="13" fill="#667085" '
            f'font-family="Arial, sans-serif">{self._escape(theme)}</text>'
            f'<rect x="{self.LEFT_X + self.INNER_PAD}" y="286" width="{self.PANEL_W - self.INNER_PAD * 2}" '
            f'height="320" rx="20" fill="#F8FAFC" stroke="#D0D5DD"/>'
            f'<text x="{self.LEFT_X + self.PANEL_W / 2}" y="442" text-anchor="middle" font-size="28" '
            f'font-weight="700" fill="#101828" font-family="Arial, sans-serif">本周还没有记录</text>'
            f'<text x="{self.LEFT_X + self.PANEL_W / 2}" y="478" text-anchor="middle" font-size="14" '
            f'fill="#667085" font-family="Arial, sans-serif">{self._escape(summary)}</text>'
            f'<text x="{self.LEFT_X + self.PANEL_W / 2}" y="518" text-anchor="middle" font-size="14" '
            f'fill="#98A2B3" font-family="Arial, sans-serif">先补几条生活记录，周报会更完整。</text>'
            f'</g>'
        )

    def _render_category_bar(self, distributions: list[dict[str, Any]]) -> str:
        x = self.LEFT_X + self.INNER_PAD
        y = 292
        width = self.PANEL_W - self.INNER_PAD * 2
        height = 26
        if not distributions:
            return (
                f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="13" fill="#EEF2F6" stroke="#D0D5DD"/>'
            )

        pieces = []
        cursor = x
        total = sum(self._int(item.get("count")) for item in distributions) or 1
        for index, item in enumerate(distributions):
            count = self._int(item.get("count"))
            category = self._text(item.get("category"))
            color = self._category_color(category)
            segment_width = width * (count / total)
            if index == len(distributions) - 1:
                segment_width = x + width - cursor
            pieces.append(
                f'<rect x="{cursor:.2f}" y="{y}" width="{max(segment_width, 0):.2f}" height="{height}" '
                f'rx="{13 if index in {0, len(distributions) - 1} else 0}" fill="{color}"/>'
            )
            cursor += segment_width
        pieces.append(
            f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="13" fill="none" stroke="#D0D5DD"/>'
        )
        return "".join(pieces)

    def _render_category_legend(self, distributions: list[dict[str, Any]]) -> str:
        if not distributions:
            return ""

        rows = []
        start_y = 346
        row_height = 30
        for index, item in enumerate(distributions[:5]):
            y = start_y + index * row_height
            label = self._text(item.get("category_label") or item.get("category") or "其他")
            count = self._int(item.get("count"))
            share = self._float(item.get("share"))
            color = self._category_color(item.get("category"))
            rows.append(
                f'<circle cx="{self.LEFT_X + self.INNER_PAD + 8}" cy="{y - 6}" r="5" fill="{color}"/>'
                f'<text x="{self.LEFT_X + self.INNER_PAD + 24}" y="{y}" font-size="13" fill="#101828" '
                f'font-family="Arial, sans-serif">{self._escape(label)}</text>'
                f'<text x="{self.LEFT_X + self.PANEL_W - self.INNER_PAD}" y="{y}" text-anchor="end" '
                f'font-size="13" fill="#667085" font-family="Arial, sans-serif">'
                f'{self._escape(f"{count} 条 · {share:.1f}%")}</text>'
            )
        return "".join(rows)

    def _render_time_bands(self, time_bands: Mapping[str, Any]) -> str:
        order = ("morning", "afternoon", "evening", "night")
        labels = {
            "morning": "上午",
            "afternoon": "下午",
            "evening": "晚上",
            "night": "深夜",
        }
        values = {band: self._int(time_bands.get(band)) for band in order}
        max_value = max(values.values()) if values else 0
        rows = [
            f'<text x="{self.LEFT_X + self.INNER_PAD}" y="510" font-size="16" font-weight="700" '
            f'fill="#101828" font-family="Arial, sans-serif">时间分布</text>'
        ]
        base_y = 538
        bar_x = self.LEFT_X + self.INNER_PAD + 80
        bar_width = self.PANEL_W - self.INNER_PAD * 2 - 120
        for index, band in enumerate(order):
            y = base_y + index * 34
            value = values[band]
            fill_width = bar_width * (value / max_value) if max_value else 0
            rows.append(
                f'<text x="{self.LEFT_X + self.INNER_PAD}" y="{y}" font-size="13" fill="#475467" '
                f'font-family="Arial, sans-serif">{labels[band]}</text>'
                f'<rect x="{bar_x}" y="{y - 14}" width="{bar_width}" height="16" rx="8" fill="#EEF2F6"/>'
                f'<rect x="{bar_x}" y="{y - 14}" width="{fill_width:.2f}" height="16" rx="8" fill="#4C78A8"/>'
                f'<text x="{self.LEFT_X + self.PANEL_W - self.INNER_PAD}" y="{y}" text-anchor="end" '
                f'font-size="13" fill="#667085" font-family="Arial, sans-serif">{value}</text>'
            )
        return "".join(rows)

    def _render_right_panel(
        self,
        reviews: list[dict[str, Any]],
        highlights: list[dict[str, Any]],
        suggestions: list[str],
    ) -> str:
        review_rows = []
        start_y = 252
        row_height = 72
        max_reviews = 5
        filled_reviews = reviews[:max_reviews]
        if len(filled_reviews) < max_reviews:
            filled_reviews.extend(
                {
                    "title": self._DEFAULT_SECTION_TITLES[index],
                    "summary": "暂无相关记录。",
                    "points": [],
                }
                for index in range(len(filled_reviews), max_reviews)
            )

        for index, review in enumerate(filled_reviews[:max_reviews]):
            y = start_y + index * row_height
            title = self._text(review.get("title") or self._DEFAULT_SECTION_TITLES[index])
            summary = self._text(review.get("summary") or "暂无相关记录。")
            points = self._string_list(review.get("points"))[:2]
            point_text = "；".join(points)
            review_rows.append(
                f'<rect x="{self.RIGHT_X}" y="{y}" width="{self.PANEL_W}" height="66" rx="16" '
                f'fill="#FFFFFF" stroke="#D0D5DD"/>'
                f'<text x="{self.RIGHT_X + 18}" y="{y + 24}" font-size="15" font-weight="700" '
                f'fill="#101828" font-family="Arial, sans-serif">{self._escape(title)}</text>'
                f'{self._multiline_text(self.RIGHT_X + 18, y + 44, summary, 12, 2, 18, "#344054")}'
                f'{self._multiline_text(self.RIGHT_X + 18, y + 60, point_text, 11, 1, 16, "#667085")}'
            )

        highlight_block = self._render_text_block(
            x=self.RIGHT_X,
            y=610,
            width=self.PANEL_W,
            title="本周高光",
            lines=[self._text(item.get("summary") or item.get("title") or "") for item in highlights[:3]],
            empty_text="本周没有明显高光。",
        )
        suggestion_block = self._render_text_block(
            x=self.RIGHT_X,
            y=742,
            width=self.PANEL_W,
            title="下周建议",
            lines=suggestions[:3],
            empty_text="先保持连续记录，下周再补全细节。",
        )

        return (
            f'<g>'
            f'{self._panel_shell(self.RIGHT_X, self.PANEL_Y, self.PANEL_W, self.PANEL_H)}'
            f'<text x="{self.RIGHT_X + self.INNER_PAD}" y="202" font-size="24" font-weight="700" '
            f'fill="#101828" font-family="Arial, sans-serif">模块回顾</text>'
            f'{self._multiline_text(self.RIGHT_X + self.INNER_PAD, 230, self._normalize_summary(reviews), 13, 1, 18, "#667085")}'
            f"{''.join(review_rows)}"
            f'{highlight_block}'
            f'{suggestion_block}'
            f'</g>'
        )

    def _render_text_block(
        self,
        x: int,
        y: int,
        width: int,
        title: str,
        lines: Sequence[str],
        empty_text: str,
    ) -> str:
        content = [line for line in lines if self._text(line)]
        body = content or [empty_text]
        wrapped_lines: list[str] = []
        for line in body[:3]:
            wrapped_lines.extend(self._wrap(line, 28, 1))
        if not wrapped_lines:
            wrapped_lines = [empty_text]
        return (
            f'<rect x="{x}" y="{y}" width="{width}" height="118" rx="16" fill="#F8FAFC" stroke="#D0D5DD"/>'
            f'<text x="{x + 18}" y="{y + 24}" font-size="15" font-weight="700" fill="#101828" '
            f'font-family="Arial, sans-serif">{self._escape(title)}</text>'
            f'{self._multiline_text(x + 18, y + 50, "；".join(wrapped_lines[:3]), 12, 3, 16, "#344054")}'
        )

    def _render_footer(self, theme: str, completion_rate: float, metadata: Mapping[str, str]) -> str:
        rate_text = f"完成度 {completion_rate * 100:.0f}%"
        return (
            f'<g>'
            f'<rect x="{self.LEFT_X}" y="{self.FOOTER_Y}" width="{self.PANEL_W * 2 + self.PANEL_GAP}" '
            f'height="{self.FOOTER_H}" rx="20" fill="#111827"/>'
            f'<text x="{self.LEFT_X + 24}" y="{self.FOOTER_Y + 38}" font-size="16" fill="#D0D5DD" '
            f'font-family="Arial, sans-serif">周主题</text>'
            f'<text x="{self.LEFT_X + 24}" y="{self.FOOTER_Y + 74}" font-size="28" font-weight="700" '
            f'fill="#FFFFFF" font-family="Arial, sans-serif">{self._escape(theme or "本周主题未填写")}</text>'
            f'<text x="{self.LEFT_X + 470}" y="{self.FOOTER_Y + 38}" font-size="16" fill="#D0D5DD" '
            f'font-family="Arial, sans-serif">完成情况</text>'
            f'<text x="{self.LEFT_X + 470}" y="{self.FOOTER_Y + 74}" font-size="28" font-weight="700" '
            f'fill="#FFFFFF" font-family="Arial, sans-serif">{self._escape(rate_text)}</text>'
            f'<text x="{self.LEFT_X + 770}" y="{self.FOOTER_Y + 38}" font-size="16" fill="#D0D5DD" '
            f'font-family="Arial, sans-serif">品牌</text>'
            f'<text x="{self.LEFT_X + 770}" y="{self.FOOTER_Y + 74}" font-size="22" font-weight="700" '
            f'fill="#FFFFFF" font-family="Arial, sans-serif">LifeAgent</text>'
            f'<text x="{self.LEFT_X + 770}" y="{self.FOOTER_Y + 102}" font-size="13" fill="#9CA3AF" '
            f'font-family="Arial, sans-serif">{self._escape(metadata["week_label"])}</text>'
            f'</g>'
        )

    def _panel_shell(self, x: int, y: int, width: int, height: int) -> str:
        return (
            f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="24" fill="#FFFFFF" '
            f'stroke="#D0D5DD"/>'
        )

    def _normalize_reviews(self, reviews: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized = list(reviews)
        if len(normalized) < len(self._DEFAULT_SECTION_TITLES):
            for index in range(len(normalized), len(self._DEFAULT_SECTION_TITLES)):
                normalized.append(
                    {
                        "title": self._DEFAULT_SECTION_TITLES[index],
                        "summary": "暂无相关记录。",
                        "points": [],
                    }
                )
        return normalized[: len(self._DEFAULT_SECTION_TITLES)]

    def _normalize_highlights(self, highlights: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not highlights:
            return []
        normalized: list[dict[str, Any]] = []
        for item in highlights[:3]:
            normalized.append(
                {
                    "title": self._text(item.get("title") or ""),
                    "summary": self._text(item.get("summary") or ""),
                }
            )
        return normalized

    def _normalize_summary(self, reviews: list[dict[str, Any]]) -> str:
        if not reviews:
            return "本周模块回顾仍为空，先补记录再看结构。"
        summary = self._text(reviews[0].get("summary") or "")
        return summary or "本周模块回顾已整理完成。"

    def _category_distribution(self, activity: Mapping[str, Any], total_events: int) -> list[dict[str, Any]]:
        distribution = activity.get("category_distribution")
        if isinstance(distribution, Sequence) and not isinstance(distribution, (str, bytes)):
            normalized: list[dict[str, Any]] = []
            for item in distribution:
                if not isinstance(item, Mapping):
                    continue
                normalized.append(
                    {
                        "category": self._text(item.get("category") or "other"),
                        "category_label": self._text(item.get("category_label") or item.get("category") or "其他"),
                        "count": self._int(item.get("count")),
                        "share": self._float(item.get("share")),
                    }
                )
            if normalized:
                return normalized[:5]
        if total_events <= 0:
            return []
        return [
            {
                "category": "other",
                "category_label": "其他",
                "count": total_events,
                "share": 100.0,
            }
        ]

    def _time_bands(self, activity: Mapping[str, Any]) -> dict[str, int]:
        bands = activity.get("time_bands")
        base = {"morning": 0, "afternoon": 0, "evening": 0, "night": 0}
        if not isinstance(bands, Mapping):
            return base
        for key in base:
            base[key] = self._int(bands.get(key))
        return base

    def _completion_rate(self, completion: Mapping[str, Any]) -> float:
        value = completion.get("completion_rate")
        if isinstance(value, (int, float)):
            return max(0.0, min(1.0, float(value)))
        completed = completion.get("completed")
        unfinished = completion.get("unfinished")
        completed_count = len(completed) if isinstance(completed, Sequence) and not isinstance(completed, (str, bytes)) else 0
        unfinished_count = len(unfinished) if isinstance(unfinished, Sequence) and not isinstance(unfinished, (str, bytes)) else 0
        total = completed_count + unfinished_count
        if not total:
            return 0.0
        return completed_count / total

    def _extract_payload(self, report: Mapping[str, Any]) -> dict[str, Any]:
        if isinstance(report.get("report_data"), Mapping):
            return dict(report["report_data"])
        if any(key in report for key in ("overview", "activity_analysis", "section_reviews", "highlights")):
            return dict(report)
        return {}

    def _extract_metadata(self, report: Mapping[str, Any]) -> dict[str, str]:
        week_start = self._format_date(report.get("week_start"))
        week_end = self._format_date(report.get("week_end"))
        if not week_start and isinstance(report.get("report_data"), Mapping):
            overview = report["report_data"].get("overview")
            if isinstance(overview, Mapping):
                week_start = self._format_date(overview.get("week_start"))
                week_end = self._format_date(overview.get("week_end"))
        week_start = week_start or "本周"
        week_end = week_end or "本周"
        return {
            "week_start": week_start,
            "week_end": week_end,
            "week_label": f"{week_start} - {week_end}",
        }

    def _format_date(self, value: Any) -> str:
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, date):
            return value.isoformat()
        text = self._text(value)
        return text

    def _mapping(self, value: Any) -> dict[str, Any]:
        if isinstance(value, Mapping):
            return dict(value)
        return {}

    def _section_reviews(self, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
            return []
        reviews: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, Mapping):
                reviews.append(dict(item))
        return reviews

    def _list_of_mappings(self, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
            return []
        items: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, Mapping):
                items.append(dict(item))
        return items

    def _string_list(self, value: Any) -> list[str]:
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
            return []
        items: list[str] = []
        for item in value:
            text = self._text(item)
            if text and text not in items:
                items.append(text)
        return items

    def _render_time_label(self, value: Any) -> str:
        return self._text(value)

    def _text(self, value: Any) -> str:
        if value is None:
            return ""
        text = str(value)
        filtered = "".join(ch for ch in text if ch in "\n\r\t" or ord(ch) >= 32)
        return filtered.strip()

    def _escape(self, value: Any) -> str:
        return html.escape(self._text(value), quote=True)

    def _multiline_text(
        self,
        x: int,
        y: int,
        text: Any,
        size: int,
        max_lines: int,
        line_height: int,
        fill: str,
    ) -> str:
        lines = self._wrap(self._text(text), width=max(1, int(28 if size >= 13 else 32)), max_lines=max_lines)
        if not lines:
            return ""
        parts = [
            f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-family="Arial, sans-serif">'
        ]
        for index, line in enumerate(lines):
            dy = 0 if index == 0 else line_height
            parts.append(
                f'<tspan x="{x}" dy="{dy}">{self._escape(line)}</tspan>'
            )
        parts.append("</text>")
        return "".join(parts)

    def _wrap(self, text: str, width: int, max_lines: int) -> list[str]:
        normalized = " ".join(text.split())
        if not normalized:
            return []
        lines = textwrap.wrap(
            normalized,
            width=width,
            break_long_words=True,
            break_on_hyphens=False,
        )
        if len(lines) > max_lines:
            lines = lines[:max_lines]
            lines[-1] = lines[-1].rstrip("。.!? ，,；;:：") + "…"
        return lines

    def _category_color(self, category: Any) -> str:
        return self._CATEGORY_COLORS.get(self._text(category) or "other", self._CATEGORY_COLORS["other"])

    def _int(self, value: Any) -> int:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return 0

    def _float(self, value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0
