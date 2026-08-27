# Demo Data Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure opening or refreshing the site performs no demo-data writes and repeated explicit seeding is idempotent.

**Architecture:** Keep page/API reads read-only. Make the existing seed script the only write entry point for demo data, with a fixed tagged batch that is replaced safely before reseeding.

**Tech Stack:** Python, unittest, PostgreSQL, FastAPI.

**Spec:** `docs/superpowers/specs/2026-08-27-calendar-schedule-and-demo-data-design.md`

## Global Constraints

- 页面加载、刷新和普通 API 查询均保持只读。
- seed 只允许操作带有明确演示标记的记录。
- 不执行全表清空，不影响真实用户数据。

### Task 1: Prove timeline reads are read-only

**Files:**
- Test: `backend/tests/test_life_event_api.py`
- Modify: `backend/tests/test_sql_tool.py`

**Interfaces:**
- `GET /api/v1/life-events` remains a read-only call.
- `SQLTool.get_recent_events()` may call `fetch_all()` only.

- [ ] **Step 1: Write the failing test** asserting a timeline request never calls `execute()` or `execute_script()` on a fake database client.
- [ ] **Step 2: Run** `python -m unittest tests.test_life_event_api tests.test_sql_tool -v`; expect the new assertion to fail if a write path is introduced.
- [ ] **Step 3: Keep the route/query implementation read-only; remove any startup or page-load seed invocation discovered during the test.
- [ ] **Step 4: Re-run** the targeted tests and expect PASS.
- [ ] **Step 5: Commit** `git add backend/tests/test_life_event_api.py backend/tests/test_sql_tool.py && git commit -m "test: keep timeline reads read-only"`.

### Task 2: Make explicit simulation seeding idempotent

**Files:**
- Modify: `backend/scripts/seed_simulation_data.py`
- Modify: `backend/tools/sql_tool.py`
- Test: `backend/tests/test_simulation_seed.py`
- Test: `backend/tests/test_sql_tool.py`

**Interfaces:**
- Add `SQLTool.delete_simulation_batch(user_id: str, conversation_id: str) -> None`.
- `seed_simulation_data.py` uses a stable default conversation id `simulation_demo` and deletes only that user/conversation before inserting.

- [ ] **Step 1: Write failing tests** for the scoped delete query and for two seed runs producing one tagged batch rather than duplicate rows.
- [ ] **Step 2: Run** `python -m unittest tests.test_simulation_seed tests.test_sql_tool -v`; expect missing-method/query failures.
- [ ] **Step 3: Implement the scoped delete using `DELETE ... WHERE user_id = %s AND conversation_id = %s`; update the seed script to call it before posting records.
- [ ] **Step 4: Run** the targeted tests and expect PASS.
- [ ] **Step 5: Commit** `git add backend/scripts/seed_simulation_data.py backend/tools/sql_tool.py backend/tests/test_simulation_seed.py backend/tests/test_sql_tool.py && git commit -m "feat: make demo seeding idempotent"`.

### Task 3: Verify refresh behavior against the real database

**Files:**
- Test: `backend/tests/test_e2e_production_smoke.py`
- Docs: `docs/handoff.md`

- [ ] **Step 1: Add a read-only count assertion around two timeline GET requests for the same user/date range.
- [ ] **Step 2: Run** `python -m unittest tests.test_e2e_production_smoke -v` with `LIFE_STEWARD_E2E=1` and verify the count is unchanged.
- [ ] **Step 3: Document that demo data loads only through the explicit seed command.
- [ ] **Step 4: Commit** the verification/documentation changes.
