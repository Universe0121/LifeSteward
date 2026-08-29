"""Render a compact, template-inspired weekly report poster as SVG."""

from __future__ import annotations

import html
import math
import textwrap
from collections.abc import Mapping, Sequence
from datetime import date, datetime
from typing import Any


class WeeklyPosterService:
    """Create a deterministic journal-style poster while keeping the SVG API."""

    WIDTH = 1080
    HEIGHT = 1080
    _FONT = "Microsoft YaHei, PingFang SC, Arial, sans-serif"
    _INK = "#27323A"
    _MUTED = "#66737A"
    _RULE = "#F0ECE2"
    _PAPER = "#FFFDF8"
    _CORAL = "#EA8B78"
    _YELLOW = "#F6C453"
    _TEAL = "#4D9A9A"
    _BLUE = "#72A7C8"
    _MINT = "#9BC7B7"

    _DEFAULT_SECTION_TITLES = ("健康与自律", "工作与学习", "创作与分享", "社交与娱乐", "生活记录")
    _CATEGORY_COLORS = {
        "sleep": _BLUE,
        "work": _CORAL,
        "study": _TEAL,
        "exercise": _MINT,
        "meal": _YELLOW,
        "social": "#B79BCB",
        "creative": "#8FB7CF",
        "entertainment": "#E8A4A4",
        "chores": "#B6A084",
        "health": "#8FBFB2",
        "other": "#AAB3B5",
    }

    def render_poster(self, report: Mapping[str, Any]) -> str:
        payload = self._extract_payload(report)
        metadata = self._extract_metadata(report)
        overview = self._mapping(payload.get("overview"))
        activity = self._mapping(payload.get("activity_analysis") or payload.get("stats"))
        reviews = self._section_reviews(payload.get("section_reviews"))
        highlights = self._list_of_mappings(payload.get("highlights"))
        completion = self._mapping(payload.get("completion"))
        suggestions = self._string_list(payload.get("next_week_suggestions") or payload.get("suggestions"))

        title = self._text(overview.get("title")) or f"{metadata['week_start']} 至 {metadata['week_end']} 周报"
        theme = self._text(overview.get("theme")) or "把这一周，画成一页清晰的小地图"
        summary = self._text(overview.get("summary") or payload.get("summary")) or "本周还没有可展示的摘要。"
        total_events = self._int(activity.get("total_events"))
        completion_rate = self._completion_rate(completion)
        distribution = self._category_distribution(activity, total_events)
        filled_reviews = self._normalize_reviews(reviews)

        return "".join([
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.WIDTH}" height="{self.HEIGHT}" viewBox="0 0 {self.WIDTH} {self.HEIGHT}" role="img" aria-label="LifeAgent weekly report poster">',
            f"<title>{self._escape(title)}</title><desc>{self._escape(summary)}</desc>",
            f'<rect width="{self.WIDTH}" height="{self.HEIGHT}" fill="{self._PAPER}"/>',
            self._background_rules(),
            self._header(title, theme, metadata),
            self._overview(summary, activity, distribution, total_events),
            self._completion(completion, completion_rate, filled_reviews, highlights),
            self._reflection(filled_reviews, suggestions, summary),
            self._footer(),
            "</svg>",
        ])

    def _background_rules(self) -> str:
        rules = [
            f'<rect x="0" y="0" width="14" height="{self.HEIGHT}" fill="{self._YELLOW}"/>',
            f'<rect x="{self.WIDTH - 14}" y="0" width="14" height="{self.HEIGHT}" fill="{self._MINT}"/>',
        ]
        for y in range(22, self.HEIGHT, 34):
            rules.append(f'<rect x="28" y="{y}" width="{self.WIDTH - 56}" height="1" fill="{self._RULE}"/>')
        return "<g>" + "".join(rules) + "</g>"

    def _header(self, title: str, theme: str, metadata: Mapping[str, str]) -> str:
        return (
            "<g>"
            f'<text x="62" y="74" font-size="24" font-weight="700" letter-spacing="1" fill="{self._CORAL}" font-family="{self._FONT}">WEEKLY LOG</text>'
            f'<text x="62" y="124" font-size="42" font-weight="700" fill="{self._INK}" font-family="{self._FONT}">{self._escape(title)}</text>'
            f'<text x="64" y="154" font-size="16" fill="{self._MUTED}" font-family="{self._FONT}">{self._escape(theme)}</text>'
            f'<text x="1012" y="112" text-anchor="end" font-size="17" font-weight="700" fill="{self._INK}" font-family="{self._FONT}">{self._escape(metadata["week_label"])}</text>'
            f'<text x="1018" y="145" text-anchor="end" font-size="28" fill="{self._YELLOW}" font-family="{self._FONT}">✦</text>'
            f'<text x="64" y="194" font-size="16" fill="{self._INK}" font-family="{self._FONT}">本周关键词：{self._escape(self._keyword(metadata, theme))}</text>'
            f'<text x="1008" y="194" text-anchor="end" font-size="14" fill="{self._MUTED}" font-family="{self._FONT}">状态</text>'
            "</g>"
        )

    def _overview(self, summary: str, activity: Mapping[str, Any], distribution: list[dict[str, Any]], total_events: int) -> str:
        lines = self._wrap(summary, 34, 2)
        body = self._multiline(64, 304, lines, 17, 25, self._MUTED)
        trend = self._text(activity.get("trend_summary")) or (f"本周共记录 {total_events} 条生活事件" if total_events else "先补一条生活记录，周报会更完整。")
        return (
            "<g>"
            f'<text x="64" y="244" font-size="19" font-weight="700" fill="{self._INK}" font-family="{self._FONT}">01  本周概览</text>'
            f'<text x="64" y="270" font-size="14" fill="{self._MUTED}" font-family="{self._FONT}">一句话总结：</text>'
            f'{body}'
            f'<text x="64" y="350" font-size="18" font-weight="700" fill="{self._INK}" font-family="{self._FONT}">时间 / 精力分配</text>'
            f'<text x="64" y="374" font-size="13" fill="{self._MUTED}" font-family="{self._FONT}">记录大致比例即可，数字可替换</text>'
            f'{self._donut(distribution, total_events)}'
            f'{self._distribution_labels(distribution)}'
            f'<text x="64" y="515" font-size="15" font-weight="700" fill="{self._CORAL}" font-family="{self._FONT}">小发现：</text>'
            f'<text x="170" y="515" font-size="14" fill="{self._MUTED}" font-family="{self._FONT}">{self._escape(self._truncate(trend, 63))}</text>'
            f'<rect x="62" y="540" width="956" height="1" fill="{self._RULE}"/> '
            "</g>"
        )

    def _donut(self, distribution: list[dict[str, Any]], total_events: int) -> str:
        cx, cy, radius, stroke = 190, 438, 54, 20
        if not distribution or total_events <= 0:
            return f'<circle cx="{cx}" cy="{cy}" r="{radius}" fill="none" stroke="#EAE6DC" stroke-width="{stroke}"/><text x="{cx}" y="{cy + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="{self._INK}" font-family="{self._FONT}">本周还没有记录</text>'
        pieces: list[str] = []
        start = -math.pi / 2
        for item in distribution[:6]:
            value = max(0, self._int(item.get("count"))) / max(1, total_events)
            end = start + value * math.tau
            pieces.append(self._arc(cx, cy, radius, start, end, stroke, self._category_color(item.get("category"))))
            start = end
        pieces.append(f'<text x="{cx}" y="{cy - 2}" text-anchor="middle" font-size="26" font-weight="700" fill="{self._INK}" font-family="{self._FONT}">{total_events}</text>')
        pieces.append(f'<text x="{cx}" y="{cy + 18}" text-anchor="middle" font-size="12" fill="{self._MUTED}" font-family="{self._FONT}">本周投入</text>')
        return "<g>" + "".join(pieces) + "</g>"

    def _arc(self, cx: float, cy: float, radius: float, start: float, end: float, stroke: float, color: str) -> str:
        x1, y1 = cx + radius * math.cos(start), cy + radius * math.sin(start)
        x2, y2 = cx + radius * math.cos(end), cy + radius * math.sin(end)
        large = 1 if end - start > math.pi else 0
        return f'<path d="M {x1:.2f} {y1:.2f} A {radius} {radius} 0 {large} 1 {x2:.2f} {y2:.2f}" fill="none" stroke="{color}" stroke-width="{stroke}" stroke-linecap="round"/>'

    def _distribution_labels(self, distribution: list[dict[str, Any]]) -> str:
        rows: list[str] = []
        for index, item in enumerate(distribution[:4]):
            x = 390 if index % 2 == 0 else 650
            y = 425 + (index // 2) * 38
            label = self._text(item.get("category_label") or item.get("category") or "其他")
            count, share = self._int(item.get("count")), self._float(item.get("share"))
            rows.append(f'<circle cx="{x}" cy="{y - 5}" r="6" fill="{self._category_color(item.get("category"))}"/><text x="{x + 16}" y="{y}" font-size="15" fill="{self._INK}" font-family="{self._FONT}">{self._escape(label)}</text><text x="{x + 160}" y="{y}" text-anchor="end" font-size="14" fill="{self._MUTED}" font-family="{self._FONT}">{count} 条 · {share:.0f}%</text>')
        return "".join(rows)

    def _completion(self, completion: Mapping[str, Any], rate: float, reviews: list[dict[str, Any]], highlights: list[dict[str, Any]]) -> str:
        completed = self._string_list(completion.get("completed"))
        projects = self._string_list(completion.get("unfinished"))
        important = self._text(highlights[0].get("summary") or highlights[0].get("title")) if highlights else (completed[0] if completed else "暂无")
        review_summary = self._text(reviews[0].get("summary")) if reviews else "暂无相关记录。"
        return (
            "<g>"
            f'<text x="64" y="590" font-size="19" font-weight="700" fill="{self._INK}" font-family="{self._FONT}">02  完成事项</text>'
            f'<text x="64" y="616" font-size="14" fill="{self._MUTED}" font-family="{self._FONT}">把做完的事打个勾，给自己一个小小的完成感</text>'
            f'{self._line_item(64, 660, "最重要的一件事", important)}'
            f'{self._line_item(64, 698, "推进中的项目", projects[0] if projects else "暂无")}'
            f'{self._line_item(64, 736, "沟通 / 协作", self._text(reviews[1].get("summary")) if len(reviews) > 1 else "暂无")}'
            f'{self._line_item(64, 774, "生活里的完成", completed[1] if len(completed) > 1 else (completed[0] if completed else "暂无"))}'
            f'<text x="820" y="666" font-size="14" font-weight="700" fill="{self._CORAL}" font-family="{self._FONT}">完成度</text>'
            f'<text x="820" y="704" font-size="30" font-weight="700" fill="{self._INK}" font-family="{self._FONT}">{len(completed)} / {len(completed) + len(projects)}</text>'
            f'<text x="820" y="730" font-size="14" fill="{self._MUTED}" font-family="{self._FONT}">{rate * 100:.0f}% 已完成</text>'
            f'<rect x="62" y="808" width="956" height="1" fill="{self._RULE}"/> '
            f'<text x="64" y="836" font-size="13" fill="{self._MUTED}" font-family="{self._FONT}">{self._escape(self._truncate(review_summary, 104))}</text>'
            "</g>"
        )

    def _reflection(self, reviews: list[dict[str, Any]], suggestions: list[str], fallback: str) -> str:
        lesson = self._text(reviews[0].get("summary")) if reviews else fallback
        next_items = suggestions[:3] or ["先保持连续记录", "留出一段完整休息", "下周再补全细节"]
        items = "".join(f'<text x="600" y="{944 + index * 24}" font-size="14" fill="{self._INK}" font-family="{self._FONT}">{index + 1}  {self._escape(self._truncate(item, 31))}</text>' for index, item in enumerate(next_items))
        return (
            "<g>"
            f'<text x="64" y="886" font-size="19" font-weight="700" fill="{self._INK}" font-family="{self._FONT}">03  复盘与下周</text>'
            f'<text x="64" y="918" font-size="15" font-weight="700" fill="{self._BLUE}" font-family="{self._FONT}">这周学到了什么？</text>'
            f'<text x="64" y="944" font-size="14" fill="{self._MUTED}" font-family="{self._FONT}">{self._escape(self._truncate(lesson, 58))}</text>'
            f'<text x="600" y="918" font-size="15" font-weight="700" fill="{self._TEAL}" font-family="{self._FONT}">下周只做三件事</text>'
            f'{items}'
            "</g>"
        )

    def _footer(self) -> str:
        return f'<g><text x="64" y="1038" font-size="13" font-weight="700" letter-spacing="1" fill="{self._MUTED}" font-family="{self._FONT}">SEE YOU NEXT WEEK</text><text x="1008" y="1038" text-anchor="end" font-size="18" fill="{self._YELLOW}" font-family="{self._FONT}">✦  ✦  ✦</text></g>'

    def _line_item(self, x: int, y: int, label: str, value: str) -> str:
        return f'<text x="{x}" y="{y}" font-size="14" fill="{self._INK}" font-family="{self._FONT}">{self._escape(label)}：</text><text x="240" y="{y}" font-size="14" fill="{self._MUTED}" font-family="{self._FONT}">{self._escape(self._truncate(value, 44))}</text>'

    def _multiline(self, x: int, y: int, lines: Sequence[str], size: int, line_height: int, fill: str) -> str:
        if not lines:
            return ""
        tspans = "".join(f'<tspan x="{x}" dy="{0 if index == 0 else line_height}">{self._escape(line)}</tspan>' for index, line in enumerate(lines))
        return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-family="{self._FONT}">{tspans}</text>'

    def _keyword(self, metadata: Mapping[str, str], theme: str) -> str:
        keyword = self._text(theme).split("，", 1)[0].split(" ", 1)[0]
        return self._truncate(keyword or metadata["week_start"], 16)

    def _normalize_reviews(self, reviews: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized = list(reviews)
        while len(normalized) < len(self._DEFAULT_SECTION_TITLES):
            index = len(normalized)
            normalized.append({"title": self._DEFAULT_SECTION_TITLES[index], "summary": "暂无相关记录。", "points": []})
        return normalized[: len(self._DEFAULT_SECTION_TITLES)]

    def _category_distribution(self, activity: Mapping[str, Any], total_events: int) -> list[dict[str, Any]]:
        distribution = activity.get("category_distribution")
        if not isinstance(distribution, Sequence) or isinstance(distribution, (str, bytes)):
            return []
        items: list[dict[str, Any]] = []
        for item in distribution:
            if not isinstance(item, Mapping):
                continue
            count = max(0, self._int(item.get("count")))
            share = self._float(item.get("share"))
            if share <= 0 and total_events:
                share = count / total_events * 100
            items.append({**dict(item), "count": count, "share": share})
        return sorted(items, key=lambda item: (-self._int(item.get("count")), self._text(item.get("category"))))

    def _extract_payload(self, report: Mapping[str, Any]) -> dict[str, Any]:
        if isinstance(report.get("report_data"), Mapping):
            return dict(report["report_data"])
        return dict(report) if any(key in report for key in ("overview", "activity_analysis", "section_reviews", "highlights")) else {}

    def _extract_metadata(self, report: Mapping[str, Any]) -> dict[str, str]:
        start, end = self._format_date(report.get("week_start")), self._format_date(report.get("week_end"))
        if isinstance(report.get("report_data"), Mapping):
            overview = report["report_data"].get("overview")
            if isinstance(overview, Mapping):
                start, end = start or self._format_date(overview.get("week_start")), end or self._format_date(overview.get("week_end"))
        start, end = start or "本周", end or "本周"
        return {"week_start": start, "week_end": end, "week_label": f"{start} - {end}"}

    def _format_date(self, value: Any) -> str:
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, date):
            return value.isoformat()
        return self._text(value)

    def _mapping(self, value: Any) -> dict[str, Any]:
        return dict(value) if isinstance(value, Mapping) else {}

    def _section_reviews(self, value: Any) -> list[dict[str, Any]]:
        return [dict(item) for item in value if isinstance(item, Mapping)] if isinstance(value, Sequence) and not isinstance(value, (str, bytes)) else []

    def _list_of_mappings(self, value: Any) -> list[dict[str, Any]]:
        return [dict(item) for item in value if isinstance(item, Mapping)] if isinstance(value, Sequence) and not isinstance(value, (str, bytes)) else []

    def _string_list(self, value: Any) -> list[str]:
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
            return []
        result: list[str] = []
        for item in value:
            text = self._text(item)
            if text and text not in result:
                result.append(text)
        return result

    def _completion_rate(self, completion: Mapping[str, Any]) -> float:
        value = completion.get("completion_rate")
        if isinstance(value, (int, float)):
            return max(0.0, min(1.0, float(value)))
        completed, unfinished = self._string_list(completion.get("completed")), self._string_list(completion.get("unfinished"))
        return len(completed) / (len(completed) + len(unfinished)) if completed or unfinished else 0.0

    def _category_color(self, category: Any) -> str:
        return self._CATEGORY_COLORS.get(self._text(category), "#AAB3B5")

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

    def _text(self, value: Any) -> str:
        if value is None:
            return ""
        return "".join(ch for ch in str(value) if ch in "\n\r\t" or ord(ch) >= 32).strip()

    def _escape(self, value: Any) -> str:
        return html.escape(self._text(value), quote=True)

    def _wrap(self, value: Any, width: int, max_lines: int) -> list[str]:
        text = " ".join(self._text(value).split())
        if not text:
            return []
        lines = textwrap.wrap(text, width=width, break_long_words=True, break_on_hyphens=False)
        if len(lines) > max_lines:
            lines = lines[:max_lines]
            lines[-1] = self._truncate(lines[-1], max(1, width - 1)) + "…"
        return lines

    def _truncate(self, value: Any, length: int) -> str:
        text = self._text(value)
        return text if len(text) <= length else text[: max(1, length - 1)] + "…"
