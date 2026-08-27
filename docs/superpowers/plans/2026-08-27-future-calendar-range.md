# Future Calendar Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the timeline browse past 7 days, today, and the next 30 days using real API data.

**Architecture:** Add explicit date-range query parameters while preserving the existing `days` parameter. The frontend owns the selectable date strip; the backend owns timezone-aware filtering.

**Tech Stack:** React, TypeScript, FastAPI, PostgreSQL, unittest.

**Spec:** `docs/superpowers/specs/2026-08-27-calendar-schedule-and-demo-data-design.md`

## Global Constraints

- 前端日期范围默认为过去 7 天、今天和未来 30 天。
- 后端保留现有 `days` 查询兼容性，并增加可选 `start_date`、`end_date` 参数。
- 查询按 `event_time` 优先、`created_at` 兜底。

### Task 1: Add date-range query support

**Files:**
- Modify: `backend/tools/sql_tool.py`
- Modify: `backend/main.py`
- Test: `backend/tests/test_sql_tool.py`
- Test: `backend/tests/test_life_event_api.py`

**Interfaces:**
- `SQLTool.get_events_in_range(user_id: str, start_date: date, end_date: date) -> list[dict[str, Any]]`.
- `GET /api/v1/life-events` accepts optional ISO `start_date` and `end_date`; if absent, existing `days` behavior remains.

- [ ] **Step 1: Write failing tests** for inclusive start/exclusive next-day end boundaries and invalid reversed dates.
- [ ] **Step 2: Run** `python -m unittest tests.test_sql_tool tests.test_life_event_api -v`; expect missing route/signature failures.
- [ ] **Step 3: Implement Asia/Shanghai midnight boundaries and the SQL predicate `COALESCE(event_time, created_at) >= start AND < end`.
- [ ] **Step 4: Run targeted tests and expect PASS.
- [ ] **Step 5: Commit** `git add backend/main.py backend/tools/sql_tool.py backend/tests/test_sql_tool.py backend/tests/test_life_event_api.py && git commit -m "feat: query calendar events by date range"`.

### Task 2: Extend frontend date selection

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/pages/Timeline.tsx`
- Test: `frontend/tests/contract.test.mjs`

**Interfaces:**
- `getLifeEvents(user_id, days?, range?: { start_date: string; end_date: string })`.
- Timeline date options contain 7 past days plus today and 30 future days.

- [ ] **Step 1: Add contract assertions** for future-date generation, `start_date`, `end_date`, and `schedule`/`reminder` labels; run the contract test and confirm it fails.
- [ ] **Step 2: Implement the API query construction and date-strip range.
- [ ] **Step 3: Add `schedule` and `reminder` to the filter/label map while retaining existing filters.
- [ ] **Step 4: Run** `node tests/contract.test.mjs` and expect PASS.
- [ ] **Step 5: Run** TypeScript and Vite build; commit the frontend changes.

### Task 3: Verify future navigation with a real event

**Files:**
- Test: `backend/tests/test_e2e_production_smoke.py`
- Docs: `docs/handoff.md`

- [ ] **Step 1: Add an E2E assertion that an event with a future `event_time` is returned by the date-range API.
- [ ] **Step 2: Run** the production E2E test with `LIFE_STEWARD_E2E=1`.
- [ ] **Step 3: Document the future range and API parameters.
- [ ] **Step 4: Commit the verification/documentation changes.
