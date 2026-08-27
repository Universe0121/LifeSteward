"""Deterministic model and agent factory used by the browser demo."""

from __future__ import annotations

import json
import re
from typing import Any, Mapping

from agents.master_agent import MasterAgent
from core.llm_service import CallableLLMService
from services.memory_service import FakeMemoryService


class DemoLLM:
    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        text = str(variables.get("user_input", ""))
        if "extracted_events" in variables:
            events = variables.get("extracted_events") or []
            if variables.get("intent") == "record_event" and events:
                event_text = "、".join(
                    str(event.get("event_content", ""))
                    for event in events
                    if event.get("event_content")
                )
                return f"已经帮你记录：{event_text}。"
            memories = variables.get("retrieved_memories") or []
            if memories:
                sleep_memories = [m for m in memories if m.get("event_type") == "sleep"]
                if ("睡" in text or "睡眠" in text) and sleep_memories:
                    durations = [m.get("duration") for m in sleep_memories if m.get("duration")]
                    if durations:
                        return f"根据你的记录，你{('今天' if '今天' in text else '')}睡了{durations[0]}个小时。"
                work_memories = [m for m in memories if m.get("event_type") == "work"]
                if ("代码" in text or "编程" in text) and work_memories:
                    durations = [m.get("duration") for m in work_memories if m.get("duration")]
                    if durations:
                        return f"根据你的记录，你今天写了{durations[0]}个小时代码。"
                study_memories = [m for m in memories if m.get("event_type") == "study"]
                if ("学习" in text or "学了" in text) and study_memories:
                    durations = [m.get("duration") for m in study_memories if m.get("duration")]
                    if durations:
                        return f"根据你的记录，你今天学习了{durations[0]}个小时。"
                emotion_memories = [m for m in memories if m.get("event_type") == "emotion"]
                if any(term in text for term in ("累", "疲惫", "感觉", "状态")) and emotion_memories:
                    descriptions = "、".join(str(m.get("event_content", "")) for m in emotion_memories)
                    return f"根据你的记录，你最近的状态是：{descriptions}。"
                if "几顿" in text or "几餐" in text:
                    meal_count = sum(
                        int(memory.get("meal_count", 1)) for memory in memories
                        if memory.get("event_type") == "diet"
                        or any(term in str(memory.get("event_content", "")) for term in ("吃", "饭"))
                    )
                    return f"根据你已经记录的内容，今天一共记录了{meal_count}顿饭。"
                memory_text = "；".join(
                    str(memory.get("event_content", "一条历史记录"))
                    for memory in memories
                )
                return f"这是我从你的记录中找到的内容：{memory_text}。"
            return "我暂时没有找到与你的问题相关的历史记录。"
        if "意图分类器" in prompt or "鎰忓浘" in prompt:
            is_reflection = any(x in text for x in ("状态怎么样", "状态如何", "总结", "分析一下"))
            is_question = any(x in text for x in ("什么", "哪些", "怎么", "为什么", "吗", "？", "?"))
            intent = "reflection" if is_reflection else ("query_memory" if is_question or any(
                x in text for x in ("以前", "历史", "记得")
            ) else (
                "record_event" if any(x in text for x in (
                    "今天", "刚刚", "学习", "完成", "睡", "压力", "焦虑", "累", "开心", "感觉"
                )) else "casual_chat"
            ))
            return json.dumps({"intent": intent}, ensure_ascii=False)
        if "生活事件抽取器" in prompt or "浜嬩欢" in prompt:
            if text.startswith(("已经帮你记录", "已经记录", "这是我从你的记录中找到")):
                return json.dumps({"extracted_events": []}, ensure_ascii=False)
            events = []
            def add(event_type, content, source_text, **extra):
                events.append({"event_type": event_type, "event_content": content,
                               "event_time": "昨晚" if "昨晚" in source_text else ("今天" if "今天" in source_text else None),
                               "emotion": extra.pop("emotion", None), "impact": None,
                               "importance_score": 0.7, "source": "text", "source_text": source_text, **extra})
            numeral = r"\d+|[一二两三四五六七八九十百]+"
            for m in re.finditer(rf"(今天|昨晚)?[^，。；;]*?(吃了?{numeral}顿饭|吃了?{numeral}顿|{numeral}顿饭)", text):
                count_match = re.search(rf"({numeral})顿", m.group(0))
                count = count_match.group(1) if count_match else None
                count = {"一":"1","两":"2","二":"2","三":"3","四":"4","五":"5","六":"6","七":"7","八":"8","九":"9","十":"10"}.get(count, count)
                add("diet", m.group(0), m.group(0), **({"meal_count": count} if count else {}))
            for m in re.finditer(r"(今天|昨晚)?[^，。；;]*?(睡(?:得不太好|得不好)?[^，。；;]*?(?:\d+|[一二两三四五六七八九十]+)个小时)", text):
                nums = re.search(r"(\d+|[一二两三四五六七八九十]+)个小时", m.group(0))
                value = nums.group(1) if nums else None
                value = {"一":"1","两":"2","二":"2","三":"3","四":"4","五":"5","六":"6","七":"7","八":"8","九":"9","十":"10"}.get(value, value)
                add("sleep", m.group(0), m.group(0), duration=value, duration_unit="hour")
            for m in re.finditer(r"([^，。；;]*?学习[^，。；;]*?(?:\d+|[一二两三四五六七八九十]+)小时|写了?[^，。；;]*?代码)", text):
                nums = re.search(r"(\d+|[一二两三四五六七八九十]+)个?小时", m.group(0))
                value = nums.group(1) if nums else None
                value = {"一":"1","两":"2","二":"2","三":"3","四":"4","五":"5","六":"6","七":"7","八":"8","九":"9","十":"10"}.get(value, value)
                add("study" if "学习" in m.group(0) else "work", m.group(0), m.group(0), **({"duration": value, "duration_unit": "hour"} if value else {}))
            if "累" in text or "疲惫" in text:
                add("emotion", "感觉很累", "好累呀" if "好累呀" in text else text, emotion="tired")
            if not events:
                add("other", text, text, emotion="tired" if "累" in text else None)
            return json.dumps({"extracted_events": events}, ensure_ascii=False)
        return "这是一个 Mock 回复：我已经收到你的消息啦。"


def create_demo_agent() -> MasterAgent:
    return MasterAgent(
        llm_service=DemoLLM(),
        memory_service=FakeMemoryService([
            {"event_content": "散步和短暂休息有助于缓解压力", "event_type": "adjustment"},
        ]),
    )


_demo_agent: MasterAgent | None = None


def get_demo_agent() -> MasterAgent:
    """Return the process-local demo agent so mock memories survive requests."""
    global _demo_agent
    if _demo_agent is None:
        _demo_agent = create_demo_agent()
    return _demo_agent
