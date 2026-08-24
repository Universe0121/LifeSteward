# LifeAgent Day1 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal React + TypeScript + Vite website Demo for the three Day1 frontend pages.

**Architecture:** The frontend owns presentation, local mock data, and HTTP calls only. Chat uses `POST /api/v1/chat` with a local fallback; timeline and profile render mock data so the Demo works before those backend endpoints exist.

**Tech Stack:** React, TypeScript, Vite, React Router, plain CSS.

**Spec:** `docs/superpowers/specs/2026-08-24-lifeagent-day1-frontend-design.md`

## Global Constraints

- Keep the Day1 scope to ChatHome, Timeline, and Profile.
- Keep API and mock fields in `snake_case`.
- Do not modify backend business code, frozen API names, or Agent responsibilities.
- Frontend must not access LLM or database directly.
- Use plain CSS and simple components; do not add a UI framework.

---

### Task 1: Rebuild the Vite project shell

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`

- [ ] **Step 1: Write the failing contract check**

Create a file check that asserts the required project files and scripts exist after implementation.

- [ ] **Step 2: Run the check and confirm it fails**

Run the workspace file check before creating the files; the current frontend is incomplete and its package manifest is invalid.

- [ ] **Step 3: Write the minimal project shell**

Add the Vite scripts `dev`, `build`, and `preview`, enable JSON imports, and mount the React application through `src/main.tsx`.

- [ ] **Step 4: Run the file check again**

Confirm the required shell files and valid JSON exist.

### Task 2: Implement the three pages and shared styles

**Files:**
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`
- Create: `frontend/src/pages/ChatHome.tsx`
- Create: `frontend/src/pages/Timeline.tsx`
- Create: `frontend/src/pages/Profile.tsx`
- Create: `frontend/src/mocks/life_events.json`
- Create: `frontend/src/mocks/user_profile.json`

- [ ] **Step 1: Write the page contract check**

Assert that the three page modules, required labels, and mock keys exist.

- [ ] **Step 2: Run the check and confirm it fails**

Run the check before adding the page modules.

- [ ] **Step 3: Implement the page behavior**

Use React state for chat messages and status. Render `life_events` as timeline cards and `user_profile` as profile rows. Use responsive plain CSS based on the supplied visual references.

- [ ] **Step 4: Run the check again**

Confirm all three page contracts and mock fields are present.

### Task 3: Add the chat API boundary and fallback

**Files:**
- Create: `frontend/src/api.ts`
- Modify: `frontend/src/pages/ChatHome.tsx`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/.env.development`

- [ ] **Step 1: Write the API contract check**

Assert that the request uses `user_id`, `conversation_id`, and `user_input`, and the response reads `assistant_response`, `intent`, and `extracted_events`.

- [ ] **Step 2: Run the check and confirm it fails**

Run it before adding the API module.

- [ ] **Step 3: Implement the API boundary**

POST to `/api/v1/chat` through the Vite proxy. On failure, append a local assistant response and set the task status to a degraded state.

- [ ] **Step 4: Run the check again**

Confirm the endpoint, fields, and fallback text are present.

### Task 4: Write Day1 delivery documentation

**Files:**
- Modify: `docs/架构调整说明.md`
- Modify: `docs/开发规范检查记录.md`
- Modify: `docs/每日开发记录_2026-08-24.md`
- Modify: `docs/handoff.md`

- [ ] **Step 1: Update the architecture note**

Record the three-page scope, frozen chain, frontend/backend boundary, and mock strategy.

- [ ] **Step 2: Update the compliance record**

Check naming, layer boundaries, AgentState alignment, and explicit out-of-scope items.

- [ ] **Step 3: Update the daily record and handoff**

Record files, startup commands, interface contract, known environment limitation, and next handoff actions.

### Task 5: Verify the deliverable

- [ ] **Step 1: Validate JSON and source contracts**

Use PowerShell file checks and JSON parsing.

- [ ] **Step 2: Install dependencies when Node/npm is available**

Run `npm install` in `frontend` only if the runtime is available.

- [ ] **Step 3: Run the production build when available**

Run `npm run build` and report the actual exit code.

- [ ] **Step 4: Report remaining environment limitations**

If Node/npm remains unavailable, state that the source and JSON checks passed but the Vite build could not run locally.
