"""Agent that turns weekly life events into a structured report."""

from __future__ import annotations

import json
import re
from collections import Counter
from collections.abc import Mapping, Sequence
from copy import deepcopy
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from core.llm_service import (
    LLMResponseError,
    LLMService,
    LLMTimeoutError,
    get_llm_service,
    load_prompt,
)

try:  # pragma: no cover - platform dependent timezone database availability
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover - fallback for minimal Windows images
    ZoneInfo = None  # type: ignore[assignment]


try:
    _SHANGHAI_TZ = ZoneInfo("Asia/Shanghai") if ZoneInfo is not None else timezone(timedelta(hours=8))
except Exception:  # pragma: no cover - fallback when tzdata is unavailable
    _SHANGHAI_TZ = timezone(timedelta(hours=8))


class WeeklyReportAgent:
    _prompt_name = "weekly_report_prompt.md"
    _section_definitions = (
        ("健康与自律", {"sleep", "exercise", "health", "meal", "chores"}),
        ("工作与学习", {"work", "study"}),
        ("创作与分享", {"creative"}),
        ("社交与娱乐", {"social", "entertainment"}),
        ("生活记录", set()),
    )
    _category_labels = {
        "sleep": "睡眠",
        "work": "工作",
        "study": "学习",
        "exercise": "运动",
        "meal": "饮食",
        "social": "社交",
        "creative": "创作",
        "entertainment": "娱乐",
        "chores": "家务",
        "health": "健康",
        "other": "其他",
    }
    _category_aliases = {
        "sleep": ("sleep", "nap", "rest", "睡", "睡眠", "午睡", "补觉"),
        "work": ("work", "job", "office", "meeting", "project", "工作", "加班", "会议"),
        "study": ("study", "learn", "reading", "course", "research", "学习", "复习", "阅读", "上课"),
        "exercise": ("exercise", "sport", "workout", "run", "walk", "gym", "运动", "跑步", "散步", "健身"),
        "meal": ("meal", "eat", "breakfast", "lunch", "dinner", "cook", "吃", "饭", "早餐", "午餐", "晚餐", "做饭"),
        "social": ("social", "friend", "family", "call", "chat", "聚会", "社交", "聊天", "见面", "电话"),
        "creative": ("creative", "create", "write", "design", "art", "share", "publish", "创作", "写作", "设计", "分享", "发布"),
        "entertainment": ("entertainment", "game", "movie", "music", "play", "娱乐", "游戏", "看电影", "听歌"),
        "chores": ("chores", "clean", "laundry", "shopping", "errand", "housework", "家务", "打扫", "洗衣", "采购", "收拾"),
        "health": ("health", "medical", "doctor", "medication", "checkup", "健康", "就医", "吃药", "体检"),
    }
    _empty_state_suggestions = (
        "先记录一条日常事件，给周报留下一点骨架。",
        "把睡眠、工作或学习里的一个片段写完整。",
        "尽量保留时间、地点和感受，后面更好回顾。",
    )

    def __init__(self, llm_service: LLMService | None = None) -> None:
        self._llm_service = llm_service

    def process(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        """Compatibility wrapper for mapping-style callers."""

        return self.generate(
            user_id=payload.get("user_id", ""),
            week_start=payload.get("week_start", ""),
            week_end=payload.get("week_end"),
            events=payload.get("events") or payload.get("event_list") or [],
            user_profile=payload.get("user_profile") or {},
        )

    def generate(
        self,
        user_id: str,
        week_start: date | datetime | str,
        week_end: date | datetime | str | None = None,
        events: Sequence[Mapping[str, Any]] | None = None,
        user_profile: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            raise ValueError("user_id is required")

        normalized_week_start = self._coerce_date(week_start, "week_start")
        normalized_week_end = (
            self._coerce_date(week_end, "week_end")
            if week_end is not None
            else normalized_week_start + timedelta(days=6)
        )
        if normalized_week_end < normalized_week_start:
            raise ValueError("week_end must be on or after week_start")

        normalized_events = self._normalize_events(
            events or [],
            normalized_week_start,
            normalized_week_end,
        )
        normalized_profile = (
            dict(user_profile) if isinstance(user_profile, Mapping) else {}
        )
        base_report = self._build_base_report(
            normalized_user_id,
            normalized_week_start,
            normalized_week_end,
            normalized_events,
        )
        if not normalized_events:
            return base_report

        try:
            raw_response = (self._llm_service or get_llm_service()).generate(
                load_prompt(self._prompt_name),
                {
                    "user_id": normalized_user_id,
                    "week_start": normalized_week_start.isoformat(),
                    "week_end": normalized_week_end.isoformat(),
                    "user_profile": normalized_profile,
                    "events": normalized_events,
                    "computed_report": base_report,
                    "computed_stats": base_report["activity_analysis"],
                    "output_contract": {
                        "overview": ["title", "theme", "summary", "week_start", "week_end"],
                        "activity_analysis": [
                            "summary",
                            "trend_summary",
                            "comparison_note",
                        ],
                        "section_reviews": ["title", "summary", "points", "evidence"],
                        "highlights": [
                            "title",
                            "summary",
                            "event_ids",
                            "event_type",
                            "emotion",
                            "evidence",
                        ],
                        "completion": ["completed", "unfinished", "summary"],
                        "next_week_suggestions": [],
                    },
                },
            )
            parsed = self._parse_response(raw_response)
            return self._merge_report(base_report, parsed)
        except (LLMTimeoutError, TimeoutError, LLMResponseError, RuntimeError, ValueError, json.JSONDecodeError, TypeError):
            return base_report

    def generate_for_week(
        self,
        user_id: str,
        week_start: date | datetime | str,
        week_end: date | datetime | str | None = None,
        events: Sequence[Mapping[str, Any]] | None = None,
        user_profile: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self.generate(user_id, week_start, week_end, events, user_profile)

    def _build_base_report(
        self,
        user_id: str,
        week_start: date,
        week_end: date,
        events: list[dict[str, Any]],
    ) -> dict[str, Any]:
        activity_analysis = self._build_activity_analysis(events, week_start, week_end)
        section_reviews = self._build_section_reviews(events)
        highlights = self._build_highlights(events)
        completion = self._build_completion(section_reviews, activity_analysis)
        return {
            "overview": self._build_overview(user_id, week_start, week_end, activity_analysis),
            "activity_analysis": activity_analysis,
            "section_reviews": section_reviews,
            "highlights": highlights,
            "completion": completion,
            "next_week_suggestions": self._build_next_week_suggestions(
                activity_analysis,
                section_reviews,
            ),
        }

    def _build_overview(
        self,
        user_id: str,
        week_start: date,
        week_end: date,
        activity_analysis: dict[str, Any],
    ) -> dict[str, Any]:
        total_events = int(activity_analysis.get("total_events", 0))
        dominant_category = str(activity_analysis.get("dominant_category", "其他"))
        dominant_label = self._category_labels.get(dominant_category, dominant_category)
        if total_events <= 0:
            return {
                "title": f"{week_start.isoformat()} 至 {week_end.isoformat()} 周报",
                "theme": "暂无记录",
                "summary": "本周还没有记录，先把生活里发生的小事记下来。",
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
            }
        secondary_labels = [
            item["category_label"]
            for item in activity_analysis.get("category_distribution", [])[1:3]
            if isinstance(item, Mapping) and item.get("category_label")
        ]
        theme_bits = [dominant_label, *secondary_labels]
        theme = " / ".join(dict.fromkeys(theme_bits)) if theme_bits else "本周概览"
        if total_events == 1:
            summary = f"{user_id} 本周只记录了 1 条事件，重点落在 {dominant_label}。"
        else:
            summary = (
                f"本周共记录 {total_events} 条事件，重心主要在 {dominant_label}，"
                f"其余节奏相对分散。"
            )
        return {
            "title": f"{week_start.isoformat()} 至 {week_end.isoformat()} 周报",
            "theme": theme,
            "summary": summary,
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
        }

    def _build_activity_analysis(
        self,
        events: list[dict[str, Any]],
        week_start: date,
        week_end: date,
    ) -> dict[str, Any]:
        total_events = len(events)
        category_counts = Counter(event["category"] for event in events)
        category_distribution = [
            {
                "category": category,
                "category_label": self._category_labels.get(category, category),
                "count": count,
                "share": round((count / total_events) * 100, 1) if total_events else 0.0,
            }
            for category, count in category_counts.most_common()
        ]
        time_bands = Counter(event["time_band"] for event in events)
        time_structure = {
            band: int(time_bands.get(band, 0))
            for band in ("morning", "afternoon", "evening", "night")
        }
        dominant_category = category_distribution[0]["category"] if category_distribution else "other"
        dominant_label = self._category_labels.get(dominant_category, dominant_category)
        if total_events <= 0:
            summary = "本周暂无记录，无法分析时间结构。"
            trend_summary = "本周没有可用事件，时间结构与趋势均为空。"
        elif len(category_distribution) == 1:
            summary = f"时间结构高度集中在 {dominant_label}。"
            trend_summary = f"本周记录几乎都来自 {dominant_label}，节奏非常单一。"
        else:
            second_label = category_distribution[1]["category_label"]
            summary = f"时间结构以 {dominant_label} 为主，{second_label} 形成次要支撑。"
            trend_summary = (
                f"本周记录主要集中在 {dominant_label}，"
                f"其次是 {second_label}，整体节奏比单点爆发更均衡。"
            )
        return {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "total_events": total_events,
            "category_distribution": category_distribution,
            "time_bands": time_structure,
            "dominant_category": dominant_category,
            "dominant_category_label": dominant_label,
            "summary": summary,
            "trend_summary": trend_summary,
            "comparison_note": "未提供上周数据，仅保留本周结构分析。",
        }

    def _build_section_reviews(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        reviews = []
        for title, categories in self._section_definitions:
            matched_events = self._match_events(events, categories)
            reviews.append(self._section_review_from_events(title, matched_events))
        return reviews

    def _section_review_from_events(
        self,
        title: str,
        events: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not events:
            return {
                "title": title,
                "summary": "本周暂无相关记录。",
                "points": [],
                "evidence": [],
            }

        labels = Counter(event["category_label"] for event in events)
        dominant_label = labels.most_common(1)[0][0]
        summary = f"本周在 {title} 上共记录 {len(events)} 条，主要集中在 {dominant_label}。"
        points = []
        top_event = events[0]
        points.append(f"代表记录：{top_event['excerpt']}")
        if len(labels) > 1:
            other_labels = [label for label in labels if label != dominant_label][:2]
            if other_labels:
                points.append(f"同时覆盖：{'、'.join(other_labels)}。")
        if any(event.get("emotion") for event in events):
            emotions = [event["emotion"] for event in events if event.get("emotion")]
            points.append(f"情绪线索：{self._summarize_values(emotions)}。")
        evidence = self._collect_evidence(events)
        return {
            "title": title,
            "summary": summary,
            "points": points[:4],
            "evidence": evidence,
        }

    def _build_highlights(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        ranked_events = sorted(
            events,
            key=lambda event: (
                -float(event["importance_score"]),
                event["sort_time"],
                int(event["sort_index"]),
            ),
        )
        highlights = []
        for event in ranked_events[:5]:
            summary_parts = [event["excerpt"]]
            if event.get("emotion"):
                summary_parts.append(f"情绪：{event['emotion']}")
            if event.get("time_label"):
                summary_parts.append(f"时间：{event['time_label']}")
            highlights.append(
                {
                    "title": f"{event['category_label']}高光",
                    "summary": "；".join(summary_parts),
                    "event_ids": [event["life_event_id"]] if event.get("life_event_id") is not None else [],
                    "event_type": event["category"],
                    "emotion": event.get("emotion", ""),
                    "evidence": [event["excerpt"]],
                }
            )
        return highlights

    def _build_completion(
        self,
        section_reviews: list[dict[str, Any]],
        activity_analysis: dict[str, Any],
    ) -> dict[str, Any]:
        completed = [
            f"{review['title']}：{self._review_brief(review)}"
            for review in section_reviews
            if review.get("evidence")
        ]
        unfinished = [
            f"{review['title']}：暂无明显记录"
            for review in section_reviews
            if not review.get("evidence")
        ]
        completion_rate = round(len(completed) / len(section_reviews), 2) if section_reviews else 0.0
        if not completed:
            summary = "本周尚未形成可复盘的记录。"
        else:
            dominant_label = activity_analysis.get("dominant_category_label", "主要模块")
            summary = (
                f"本周有 {len(completed)} 个模块出现记录，整体重心在 {dominant_label}。"
            )
        return {
            "completed": completed,
            "unfinished": unfinished,
            "summary": summary,
            "completion_rate": completion_rate,
        }

    def _build_next_week_suggestions(
        self,
        activity_analysis: dict[str, Any],
        section_reviews: list[dict[str, Any]],
    ) -> list[str]:
        if not activity_analysis.get("total_events"):
            return list(self._empty_state_suggestions)

        suggestions: list[str] = []
        unfinished_titles = [
            review["title"] for review in section_reviews if not review.get("evidence")
        ]
        for title in unfinished_titles:
            suggestions.append(f"下周可以补一补 {title} 的记录，把时间和感受写完整。")
            if len(suggestions) >= 2:
                break
        dominant_label = activity_analysis.get("dominant_category_label", "当前节奏")
        suggestions.append(f"继续保持 {dominant_label} 的连续记录，看看趋势会不会更清晰。")
        return suggestions[:3]

    def _match_events(
        self,
        events: list[dict[str, Any]],
        categories: set[str],
    ) -> list[dict[str, Any]]:
        if not categories:
            return list(events)
        return [event for event in events if event["category"] in categories]

    def _collect_evidence(self, events: list[dict[str, Any]]) -> list[str]:
        evidence: list[str] = []
        for event in events[:3]:
            evidence.append(event["excerpt"])
        return evidence

    def _review_brief(self, review: Mapping[str, Any]) -> str:
        summary = str(review.get("summary", "")).strip()
        if summary:
            return summary
        points = review.get("points", [])
        if isinstance(points, list) and points:
            first_point = str(points[0]).strip()
            if first_point:
                return first_point
        return "暂无详细说明"

    def _merge_report(
        self,
        base_report: dict[str, Any],
        model_report: dict[str, Any],
    ) -> dict[str, Any]:
        merged = deepcopy(base_report)
        if not isinstance(model_report, Mapping):
            return merged
        if isinstance(model_report.get("overview"), Mapping):
            merged["overview"] = self._merge_overview(
                merged["overview"],
                model_report["overview"],
            )
        if isinstance(model_report.get("activity_analysis"), Mapping):
            merged["activity_analysis"] = self._merge_activity_analysis(
                merged["activity_analysis"],
                model_report["activity_analysis"],
            )
        if isinstance(model_report.get("section_reviews"), list):
            merged["section_reviews"] = self._merge_section_reviews(
                merged["section_reviews"],
                model_report["section_reviews"],
            )
        if isinstance(model_report.get("highlights"), list):
            merged["highlights"] = self._merge_highlights(
                merged["highlights"],
                model_report["highlights"],
            )
        if isinstance(model_report.get("completion"), Mapping):
            merged["completion"] = self._merge_completion(
                merged["completion"],
                model_report["completion"],
            )
        if isinstance(model_report.get("next_week_suggestions"), list):
            merged["next_week_suggestions"] = self._merge_suggestions(
                merged["next_week_suggestions"],
                model_report["next_week_suggestions"],
            )
        return merged

    def _merge_overview(
        self,
        base: Mapping[str, Any],
        model: Mapping[str, Any],
    ) -> dict[str, Any]:
        merged = dict(base)
        for key in ("title", "theme", "summary"):
            value = self._string_or_none(model.get(key))
            if value:
                merged[key] = value
        return merged

    def _merge_activity_analysis(
        self,
        base: Mapping[str, Any],
        model: Mapping[str, Any],
    ) -> dict[str, Any]:
        merged = dict(base)
        for key in ("summary", "trend_summary", "comparison_note"):
            value = self._string_or_none(model.get(key))
            if value:
                merged[key] = value
        return merged

    def _merge_section_reviews(
        self,
        base_reviews: list[dict[str, Any]],
        model_reviews: Sequence[Any],
    ) -> list[dict[str, Any]]:
        merged: list[dict[str, Any]] = []
        for index, base_review in enumerate(base_reviews):
            merged_review = dict(base_review)
            if index < len(model_reviews) and isinstance(model_reviews[index], Mapping):
                model_review = model_reviews[index]
                summary = self._string_or_none(model_review.get("summary"))
                if summary:
                    merged_review["summary"] = summary
                points = self._clean_string_list(model_review.get("points"), limit=4)
                if points:
                    merged_review["points"] = points
            merged.append(merged_review)
        return merged

    def _merge_highlights(
        self,
        base_highlights: list[dict[str, Any]],
        model_highlights: Sequence[Any],
    ) -> list[dict[str, Any]]:
        merged: list[dict[str, Any]] = []
        for index, base_highlight in enumerate(base_highlights[:5]):
            merged_highlight = dict(base_highlight)
            if index < len(model_highlights) and isinstance(model_highlights[index], Mapping):
                model_highlight = model_highlights[index]
                title = self._string_or_none(model_highlight.get("title"))
                if title:
                    merged_highlight["title"] = title
                summary = self._string_or_none(model_highlight.get("summary"))
                if summary:
                    merged_highlight["summary"] = summary
                emotion = self._string_or_none(model_highlight.get("emotion"))
                if emotion is not None:
                    merged_highlight["emotion"] = emotion
            merged.append(merged_highlight)
        return merged[:5]

    def _merge_completion(
        self,
        base_completion: Mapping[str, Any],
        model_completion: Mapping[str, Any],
    ) -> dict[str, Any]:
        merged = dict(base_completion)
        summary = self._string_or_none(model_completion.get("summary"))
        if summary:
            merged["summary"] = summary
        return merged

    def _merge_suggestions(
        self,
        base_suggestions: Sequence[Any],
        model_suggestions: Sequence[Any],
    ) -> list[str]:
        suggestions = self._clean_string_list(model_suggestions, limit=3)
        if not suggestions:
            suggestions = self._clean_string_list(base_suggestions, limit=3)
        return suggestions[:3]

    def _parse_response(self, raw_response: Any) -> dict[str, Any]:
        text = str(raw_response or "").strip()
        if not text:
            raise ValueError("weekly report agent returned empty response")
        payload = self._load_json(text)
        if not isinstance(payload, Mapping):
            raise ValueError("weekly report agent returned invalid JSON")
        return dict(payload)

    def _load_json(self, text: str) -> Any:
        stripped = self._strip_code_fence(text)
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            match = re.search(r"(\{[\s\S]*\})", stripped)
            if match:
                return json.loads(match.group(1))
            raise

    @staticmethod
    def _strip_code_fence(text: str) -> str:
        content = text.strip()
        if not content.startswith("```"):
            return content
        lines = content.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()

    def _normalize_events(
        self,
        events: Sequence[Mapping[str, Any]],
        week_start: date,
        week_end: date,
    ) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for index, event in enumerate(events):
            if not isinstance(event, Mapping):
                continue
            normalized_event = self._normalize_event(dict(event), index)
            if normalized_event is None:
                continue
            event_date = normalized_event.get("event_date")
            if event_date is not None and not (week_start <= event_date <= week_end):
                continue
            normalized.append(normalized_event)
        return normalized

    def _normalize_event(
        self,
        event: dict[str, Any],
        sort_index: int,
    ) -> dict[str, Any] | None:
        content = str(event.get("event_content") or event.get("source_text") or "").strip()
        if not content:
            return None
        raw_type = str(event.get("event_type") or "other").strip().lower()
        category = self._normalize_category(raw_type, content)
        event_time = self._coerce_datetime(event.get("event_time") or event.get("created_at"))
        if event_time is not None:
            localized_time = self._to_shanghai(event_time)
            time_band = self._time_band(localized_time)
            event_date = localized_time.date()
            time_label = localized_time.strftime("%m-%d %H:%M")
            sort_time = localized_time
        else:
            time_band = "unknown"
            event_date = None
            time_label = ""
            sort_time = datetime.max.replace(tzinfo=_SHANGHAI_TZ)
        return {
            "life_event_id": event.get("life_event_id"),
            "event_type": raw_type,
            "category": category,
            "category_label": self._category_labels.get(category, category),
            "event_content": content,
            "emotion": self._string_or_none(event.get("emotion")) or "",
            "importance_score": self._normalize_importance(event.get("importance_score")),
            "excerpt": self._excerpt(content),
            "source_text": self._string_or_none(event.get("source_text")) or content,
            "event_time": event_time.isoformat() if isinstance(event_time, datetime) else None,
            "event_date": event_date,
            "time_band": time_band,
            "time_label": time_label,
            "sort_time": sort_time,
            "sort_index": sort_index,
        }

    def _normalize_category(self, raw_type: str, content: str) -> str:
        for category, aliases in self._category_aliases.items():
            if raw_type == category or raw_type in aliases:
                return category
            if any(alias in raw_type for alias in aliases):
                return category
        if raw_type in {"", "other", "note", "misc", "record", "schedule", "life_event"}:
            for category, aliases in self._category_aliases.items():
                if any(alias in content for alias in aliases):
                    return category
        return "other"

    @staticmethod
    def _normalize_importance(value: Any) -> float:
        try:
            score = float(value)
        except (TypeError, ValueError):
            return 0.5
        if score != score:
            return 0.5
        return max(0.0, min(1.0, score))

    @staticmethod
    def _coerce_date(value: date | datetime | str | None, field_name: str) -> date:
        if value is None:
            raise ValueError(f"{field_name} is required")
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                raise ValueError(f"{field_name} is required")
            try:
                return date.fromisoformat(normalized)
            except ValueError:
                try:
                    return datetime.fromisoformat(normalized.replace("Z", "+00:00")).date()
                except ValueError as exc:
                    raise ValueError(f"{field_name} must be an ISO date") from exc
        raise ValueError(f"{field_name} must be a date or ISO date string")

    @staticmethod
    def _coerce_datetime(value: Any) -> datetime | None:
        if value in (None, ""):
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=_SHANGHAI_TZ)
        if isinstance(value, date):
            return datetime.combine(value, time.min, tzinfo=_SHANGHAI_TZ)
        if isinstance(value, str):
            normalized = value.strip().replace("Z", "+00:00")
            if not normalized:
                return None
            try:
                parsed = datetime.fromisoformat(normalized)
            except ValueError:
                return None
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=_SHANGHAI_TZ)
        return None

    @staticmethod
    def _to_shanghai(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=_SHANGHAI_TZ)
        return value.astimezone(_SHANGHAI_TZ)

    @staticmethod
    def _time_band(value: datetime) -> str:
        hour = value.hour
        if 5 <= hour < 12:
            return "morning"
        if 12 <= hour < 18:
            return "afternoon"
        if 18 <= hour < 23:
            return "evening"
        return "night"

    @staticmethod
    def _excerpt(text: str, limit: int = 24) -> str:
        cleaned = " ".join(str(text).split())
        if len(cleaned) <= limit:
            return cleaned
        return cleaned[: limit - 1].rstrip() + "…"

    @staticmethod
    def _string_or_none(value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _clean_string_list(self, value: Any, limit: int | None = None) -> list[str]:
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
            return []
        cleaned: list[str] = []
        for item in value:
            text = self._string_or_none(item)
            if not text:
                continue
            if text not in cleaned:
                cleaned.append(text)
            if limit is not None and len(cleaned) >= limit:
                break
        return cleaned

    @staticmethod
    def _summarize_values(values: Sequence[str], limit: int = 3) -> str:
        unique_values: list[str] = []
        for value in values:
            text = str(value).strip()
            if not text or text in unique_values:
                continue
            unique_values.append(text)
            if len(unique_values) >= limit:
                break
        return "、".join(unique_values)

