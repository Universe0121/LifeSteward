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

## 前后端联调启动方式

后端和前端需要在两个终端分别启动。

终端 1：

```text
cd backend
python -m uvicorn main:app --reload --port 8000
```

终端 2：

```text
cd frontend
pnpm install
pnpm dev
```

访问 `http://localhost:5173`，Vite 会把 `/api` 请求代理到 `http://localhost:8000`。可先检查后端依赖状态：

```text
curl http://127.0.0.1:8000/api/health
```

也可以设置 `VITE_API_BASE` 指向其他后端地址；未设置时默认使用 `/api`。

## 真实链路依赖

- `POSTGRES_DSN`：必须指向可连接且已安装 `vector` 扩展的 PostgreSQL。
- `REDIS_URL`：运行 Redis 基础设施检查时需要配置。
- `LLM_PROVIDER=qwen` 时需要 `DASHSCOPE_API_KEY`。
- `LLM_PROVIDER=stepfun` 时生成链路需要 `STEP_API_KEY`，嵌入链路仍需要 `DASHSCOPE_API_KEY`。

请将这些值写入本机 `backend/.env`，不要提交真实密钥或连接凭据。`GET /api/health` 返回 `degraded`，或测试因为缺少外部依赖而跳过，都不代表真实生产端到端链路已经通过。

## 已实现交互

- 首页任务可点击切换完成状态。
- 时间轴可切换日期、筛选事件类型、点击卡片展开详情、点击右上角回到今天。
- DIY 页面可编辑项目名称和描述、添加任务、删除任务、切换任务完成状态，数据持久化到 localStorage。

## 下一步

- 在 Node 环境中完成依赖安装和 Vite 构建。
- 启动 FastAPI 后联调聊天接口。
- 网站 Demo 验证通过后，再规划移动端迁移。
