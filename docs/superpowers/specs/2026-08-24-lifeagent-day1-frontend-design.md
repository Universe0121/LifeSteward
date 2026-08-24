# LifeAgent Day1 前端原型设计规格

## 目标

在不修改后端业务代码、冻结 API 字段和 Agent 职责的前提下，建立一个 React + TypeScript + Vite 网站 Demo，验证聊天主页、个人时间轴和个人画像三个页面的展示方向。

## 范围

实现以下页面：

1. 聊天主页：用户输入、AI 回复、当前任务状态。
2. 个人时间轴：生活事件、学习记录、行为轨迹，数据来源为 `life_events` mock。
3. 个人画像：学习习惯、作息习惯、用户偏好，数据来源为 `user_profile` mock。

不实现 Memory、Reflection、Planning、pgvector RAG、通知系统、移动端工程和后端业务改造。

## 技术方案

- 使用 React、TypeScript、Vite、React Router。
- 使用纯 CSS 和简单组件，不引入 UI 框架。
- 页面采用网站 Demo 形式，但参考提供的移动端 PNG 视觉：白色背景、深色强调色、圆角卡片、底部导航、浅蓝辅助色。
- mock 数据放在 `frontend/src/mocks/`，字段保持 `snake_case`。
- 聊天页面预留并调用后端 `POST /api/v1/chat`；后端不可用时使用本地降级回复，保证 Demo 可演示。

## 架构约束

- 前端只通过 HTTP API 与后端交互，不直接访问 LLM 或数据库。
- 后端继续遵守 `API → Service → Agent → Tool → Database`。
- Agent 间仅通过统一 `AgentState` 传递数据。
- 不修改冻结 API 字段、变量名和 Agent 核心职责。
- 今日实际链路为 `User Input → FastAPI → Master Agent → Life Understanding Agent → Interaction Agent → assistant_response`。

## 接口契约

`POST /api/v1/chat` 请求：

```json
{
  "user_id": 10001,
  "conversation_id": "conv_001",
  "user_input": "今天学习数学2小时"
}
```

响应：

```json
{
  "assistant_response": "已经记录你的学习情况",
  "intent": "record_event",
  "extracted_events": []
}
```

## 交付物

- 可运行的 `frontend/` 网站 Demo。
- `docs/架构调整说明.md`。
- `docs/开发规范检查记录.md`。
- `docs/每日开发记录_2026-08-24.md`。
- `docs/handoff.md`。

## 验收标准

- 三个页面可通过导航访问。
- 聊天页可以输入内容并显示用户消息、AI 回复和任务状态。
- 时间轴页可以展示 mock `life_events`。
- 画像页可以展示 mock `user_profile`。
- 前端字段遵守 `snake_case`，未扩展 Day1 范围。
- 依赖安装后可以执行 Vite 构建；若本机缺少 Node/npm，必须在交接文档中明确说明。
