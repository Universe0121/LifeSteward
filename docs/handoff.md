# LifeAgent Day1 Handoff

## 交接范围

本轮完成网站端五页可交互中保真原型：首页工作台、AI 聊天、个人时间轴、个人画像、自主 DIY。前端采用 React + TypeScript + Vite、纯 CSS 和 mock 数据；未修改后端业务代码。

## 前端目录

`D:\桌面\黑客松项目开发\frontend`

- `src/pages/ChatHome.tsx`：用户输入、AI 回复、当前任务状态。
- `src/pages/Home.tsx`：项目卡片、今日任务、任务勾选和聊天入口。
- `src/pages/Timeline.tsx`：按日期切换、类型筛选、事件展开和 `life_events` 展示。
- `src/pages/Profile.tsx`：展示 `user_profile`。
- `src/pages/Customize.tsx`：编辑项目、增加/删除任务、完成状态和 localStorage 保存。
- `src/api.ts`：`POST /api/v1/chat` 请求边界。
- `src/mocks/life_events.json`：时间轴 mock 数据。
- `src/mocks/timeline_events.json`：按日期组织的时间轴 mock 数据。
- `src/mocks/user_profile.json`：画像 mock 数据。
- `src/mocks/workspace.json`：首页与 DIY 工作区 mock 数据。
- `src/styles.css`：纯 CSS 视觉样式。

## 后端协作

后端路径：`D:\桌面\黑客松项目开发\LifeSteward-main\LifeSteward-main\backend`

当前聊天接口：`POST /api/v1/chat`

请求字段：`user_id`、`conversation_id`、`user_input`。

响应字段：`assistant_response`、`intent`、`extracted_events`。

开发环境通过 Vite 将 `/api` 代理到 `http://localhost:8000`。后端不可用时，聊天页显示本地 mock 回复。

## 冻结约束

- 分层：`API -> Service -> Agent -> Tool -> Database`。
- 前端不直连 LLM 或 Database。
- Agent 之间通过 `AgentState` 传递数据。
- 不修改冻结 API 字段、变量命名和 Agent 核心职责。
- 实际链路：`User Input -> FastAPI -> Master Agent -> Life Understanding Agent -> Interaction Agent -> assistant_response`。

## 启动方式

在 `frontend` 目录执行：

```text
npm install
npm run dev
```

访问 `http://localhost:5173`，通过底部导航查看五个页面：`/`、`/chat`、`/timeline`、`/profile`、`/customize`。

## 环境限制

本轮检查时系统未检测到 `node` 和 `npm`，因此无法在当前机器执行 `npm install` 和 `npm run build`。安装 Node.js 后重新执行上述命令即可验证。

## 已实现交互

- 首页任务可点击切换完成状态。
- 时间轴可切换日期、筛选事件类型、点击卡片展开详情、点击右上角回到今天。
- DIY 页面可编辑项目名称和描述、添加任务、删除任务、切换任务完成状态，数据持久化到 localStorage。

## 下一步

- 在 Node 环境中完成依赖安装和 Vite 构建。
- 启动 FastAPI 后联调聊天接口。
- 网站 Demo 验证通过后，再规划移动端迁移。
