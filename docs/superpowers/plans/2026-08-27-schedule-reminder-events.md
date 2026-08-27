# Schedule Reminder Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Chinese relative date/time and advance-reminder language into calendar-visible schedule and reminder events.

**Architecture:** Keep the existing Agent chain. Add a deterministic normalization boundary after event extraction and before persistence, using Asia/Shanghai and an injectable `now` for tests. Represent the requested meeting and preparation reminder as two `life_events` rows.

**Tech Stack:** Python `datetime`/`zoneinfo`, unittest, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-08-27-calendar-schedule-and-demo-data-design.md`

## Global Constraints

- 支持今天、明天、后天、上午/下午/晚上、中文小时和 `HH:MM`。
- 支持提前半小时和提前 N 分钟。
- 解析失败不猜测绝对时间。
- 本轮不实现操作系统或第三方推送通知。

### Task 1: Build a deterministic Chinese time parser

**Files:**
- Create: `backend/services/schedule_time.py`
- Test: `backend/tests/test_schedule_time.py`

**Interfaces:**
- `parse_chinese_datetime(text: str, now: datetime | None = None) -> datetime | None`.
- `parse_advance_minutes(text: str) -> int | None`.

- [ ] **Step 1: Write failing tests** for “明天下午三点” -> next day 15:00 Asia/Shanghai, “明天15:00”, “提前半小时” -> 30, and invalid input -> `None`.
- [ ] **Step 2: Run** `python -m unittest tests.test_schedule_time -v`; expect import/function failures.
- [ ] **Step 3: Implement using `zoneinfo.ZoneInfo("Asia/Shanghai")`, explicit relative-day parsing, and no LLM/network calls.
- [ ] **Step 4: Run the tests and expect PASS.
- [ ] **Step 5: Commit** `git add backend/services/schedule_time.py backend/tests/test_schedule_time.py && git commit -m "feat: parse Chinese schedule times"`.

### Task 2: Normalize extracted schedule/reminder events

**Files:**
- Modify: `backend/agents/life_understanding_agent.py`
- Modify: `backend/services/memory_service.py`
- Test: `backend/tests/test_core_agent_flow.py`
- Test: `backend/tests/test_memory_service.py`

**Interfaces:**
- Add `normalize_schedule_events(events: list[dict], source_text: str, now: datetime | None = None) -> list[dict]`.
- Output keeps existing event fields and emits `event_type` values `schedule` and `reminder`.

- [ ] **Step 1: Write failing tests** for the exact meeting sentence producing a 15:00 schedule event and a 14:30 reminder event, preserving `source_text`.
- [ ] **Step 2: Run targeted tests and expect failure because relative event times remain strings or one event.
- [ ] **Step 3: Implement the adapter to consume structured Agent fields first, then split the exact reminder phrase when the Agent returns one combined event.
- [ ] **Step 4: Run targeted tests and expect PASS.
- [ ] **Step 5: Commit** the normalization changes and tests.

### Task 3: Persist and display future schedule events

**Files:**
- Modify: `backend/tools/sql_tool.py`
- Modify: `frontend/src/pages/Timeline.tsx`
- Modify: `frontend/src/api.ts`
- Test: `backend/tests/test_sql_tool.py`
- Test: `frontend/tests/contract.test.mjs`

- [ ] **Step 1: Add failing persistence assertions** that timezone-aware schedule/reminder datetimes survive normalization and are returned by the date-range query.
- [ ] **Step 2: Implement only the necessary datetime coercion and labels; do not add notification infrastructure.
- [ ] **Step 3: Run backend targeted tests and frontend contract/build checks; expect PASS.
- [ ] **Step 4: Run the real E2E sentence through `POST /api/v1/chat`, then query tomorrow’s range and assert both event times.
- [ ] **Step 5: Commit the integration changes.
