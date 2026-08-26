# 成员一 Day 6 前端真实联通 Handoff

日期：2026-08-26
分支：`codex/member1-day6-integration`
基线：`c250797 feat(frontend): enhance interactive prototype and navigation`

## 修改范围

- `frontend/src/api.ts`
- `frontend/src/pages/ChatHome.tsx`
- `frontend/src/pages/Timeline.tsx`
- `frontend/src/styles.css`
- `frontend/tests/contract.test.mjs`

未修改后端、Agent、Prompt、数据库 Schema 或 migration。

## 已完成

- Chat 请求使用浏览器会话级稳定 `conversation_id`，不再固定使用 `conv_001`。
- ChatHome 显示真实 `assistant_response`、`intent`、`extracted_events`、`conversation_id` 和请求状态。
- 请求失败显示后端错误正文与 HTTP 状态，提供重试，不再生成 mock 成功回复。
- 500 错误后输入框保持可操作。
- Timeline 只读取 `GET /api/v1/life-events?user_id=10001&days=7`。
- Timeline 保留日期选择、类型筛选、详情展开、loading、empty、error、retry。
- 删除 Timeline 本地构造 `frontend_demo` 事件的入口，避免页面出现未写入数据库的假记录。

## 验证结果

- `node --test tests/contract.test.mjs`：通过，1/1。
- TypeScript 编译：通过。
- Vite production build：通过，44 modules transformed。
- 浏览器错误态：Chat 返回 500 时显示错误和重试，输入框可继续使用。
- 浏览器错误态：Timeline 返回 500 时显示错误和重新加载。
- 浏览器会话刷新后 `conversation_id` 保持一致。
- 受控 API 契约验收：ChatHome 正确显示 `intent=record_event`、1 条事件；Timeline 正确显示 API 返回的同一事件。

截图：

- `成员一/day06_chat_error_state.png`
- `成员一/day06_timeline_error_state.png`

## 正式联通状态

当前工作机没有 `backend/.env`，正式后端启动失败：`POSTGRES_DSN is required`。因此尚不能在本机证明 PostgreSQL 真实写入、Timeline 真实读回、Reflection 与 Planning 的完整生产链路。

未使用 `InMemoryMemoryService`、deterministic fallback 或 mock 成功文案代替正式验收。配置成员二提供的脱敏环境后，按以下顺序补验：

1. 启动正式后端与前端。
2. Chat 输入“今天学习数学2小时，有点累”。
3. 确认 `intent=record_event` 且页面显示后端提取事件。
4. Timeline 读回同一数据库事件。
5. 分别执行 Reflection、Planning 问题。

## 当前阻塞

- 缺少 `POSTGRES_DSN`。
- 未确认 `DASHSCOPE_API_KEY` 和真实 embedding 环境。
- 完整四步真实浏览器验收需成员二环境 Gate、成员三 production API Gate 完成后补跑。
