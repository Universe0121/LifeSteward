# LifeSteward 2026-08-26 今日开发任务

日期：2026-08-26  
目标：今天只做 Demo 收口，完成“真实数据库证据 + 正式 API + 网页演示”三者一致，禁止继续扩展功能范围。

## 一、GitHub 最新进度基线

读取基线：`origin/main@361cc37`（2026-08-26 01:54，成员三 handoff 更新）。

### 成员2最新状态

已完成：

- PostgreSQL/pgvector migration、数据库 Gate、真实 embedding 测试和手工 Demo 脚本。
- `docs/day5_database_demo_setup.md`，包含 Windows 启动、migration、测试和按用户清理数据说明。
- `SQLTool` / `VectorSearchTool` 字段和用户隔离验收增强。

未完成：

- `POSTGRES_DSN` 未配置，数据库集成 5 项全部 skip。
- `DASHSCOPE_API_KEY` 未配置，真实 embedding 和 pgvector 检索仍无最终证据。
- 尚未用正式网页入口完成 `user_id=10001` 三条 Demo 数据的真实验收。

### 成员3最新状态

已完成：

- `GET /api/v1/life-events` 的 schema、service、route 和异常测试。
- `record_event` 持久化失败向 API 边界传播，避免伪造“保存成功”。
- 手工 E2E 已覆盖聊天写入、数据库检查、时间轴回读、Reflection、Planning。
- 在一次本地联调中得到：`life_events_count=3`、`memory_count=6`、embedding 维度 8、时间轴回读成功、Reflection/Planning intent 正确。

仍需确认：

- 上述联调使用 deterministic fallback，不能替代真实 DashScope embedding 验收。
- 正式网页聊天页仍需确认不存在 mock 成功 fallback。
- 最新 handoff 中分支和 commit 尚未补全。

### 当前测试事实

- GitHub `origin/main` 后端完整测试：`Ran 90 tests ... OK (skipped=8)`。
- 8 项跳过主要来自 `POSTGRES_DSN`、`DASHSCOPE_API_KEY`、`REDIS_URL` 和显式关闭的 E2E。
- 前端 contract test 通过；在干净 worktree 中没有安装前端依赖，因此生产 build 需在真实开发工作区重新执行。
- 当前 `frontend/src/pages/ChatHome.tsx` 仍在请求失败时显示“演示模式：已使用 mock 回复”，这是今天必须修掉的演示风险。

## 二、今天的最终验收链路

```text
网页 ChatHome
  -> POST /api/v1/chat
  -> MasterAgent
  -> ToolMemoryService
  -> SQLTool / VectorSearchTool
  -> PostgreSQL + pgvector
  -> GET /api/v1/life-events
  -> 网页 Timeline
  -> Reflection / Planning
```

必须真实演示：

1. 输入“最近三天每天只睡5小时”。
2. 输入“最近学习效率很差”。
3. 输入“压力比较大”。
4. 切换时间轴，读回这三条真实记录。
5. 输入“最近为什么学习效率下降？”，返回 `intent=reflection`。
6. 输入“根据我最近的状态，帮我安排明天的学习计划”，返回 `intent=planning`。
7. 临时停掉数据库或后端，页面显示失败，不得显示“已经记录成功”。

## 三、成员2：真实数据库与 embedding Gate Owner

### P0-1：10:00 前完成环境 Gate

- 从最新 `origin/main@361cc37` 工作区执行，不使用旧下载目录。
- 确认 `backend/.env` 中 `POSTGRES_DSN`、`DASHSCOPE_API_KEY`、`EMBEDDING_MODEL_NAME` 已配置；真实值不得提交。
- 执行 migration，并输出脱敏健康检查：`connected=True`、`vector_extension_available=True`。
- 若 10:00 仍拿不到 DSN/key，立即在群内标记外部阻塞；不得把 deterministic fallback 宣称为真实验收。

### P0-2：11:30 前通过数据库 5 项 Gate

运行：

```powershell
cd backend
python -m unittest tests.test_database_integration -v
```

必须实跑并通过：

- PostgreSQL/pgvector health check。
- 七张表存在检查。
- `SQLTool.save_life_events()` / `get_recent_events()` round-trip。
- `user_profile` round-trip。
- 真实 `LLMService.embed_text()` + pgvector round-trip，返回 `memory_id`、`memory_content`、`similarity_score` 和真实维度。

### P0-3：14:00 前交付真实数据证据

- 使用正式 `/api/v1/chat`，不要直接 SQL 插入，写入三条用户 `10001` 数据。
- 运行 `backend/tests/manual_day5_demo_flow.py` 或等价命令，确认 `life_events`、`memories` 和时间轴查询都来自同一用户。
- 记录脱敏证据：embedding 模型名、维度、事件数量、记忆数量、检索 top 结果字段。
- 只允许使用按 `user_id=10001` 清理的 SQL，禁止清空整库。

### P0-4：16:00 前交给成员3

- DSN 状态：configured/unavailable，不发送密码。
- migration 和 vector 扩展状态。
- 真实 embedding 维度。
- `SQLTool` 和 `VectorSearchTool` 返回字段样例。
- 数据库 Gate 5/5 输出摘要。

### 成员2禁止事项

- 不做 Redis、监控、数据库大重构或新表设计。
- 不用固定向量作为最终证据。
- 不修改 Agent、Prompt、React；跨边界问题只提供最小字段/错误信息。

## 四、成员3：生产 API 与 E2E Owner

### P0-1：10:30 前完成最新基线回归

- 基于 `origin/main@361cc37` 工作，不覆盖成员2的数据库改动。
- 运行完整后端测试并保存 `90 tests` 的当前结果。
- 将 `backend/tests/test_master_agent_routing.py` 中 planning 路由的空壳 `pass` 测试补成真实断言：必须验证 `MemoryAgent -> PlanningAgent -> InteractionAgent` 的顺序、`generated_plan` 字段和用户响应。

### P0-2：13:00 前完成正式 API 语义收口

- 保持 `GET /api/v1/life-events?user_id=10001&days=7` 公共字段不变。
- 确认 `record_event` 持久化异常返回标准错误，InteractionAgent 不被调用，不出现成功文案。
- 为以下情况保留测试：正常结果、空结果、非法 `user_id/days`、Tool 异常、持久化异常。
- 真实数据库不可用时允许返回明确 500 错误；禁止自动回退到 `InMemoryMemoryService`。

### P0-3：15:00 前完成真实 Reflection/Planning

在成员2确认 DSN/key 后运行：

```powershell
cd backend
$env:LIFE_STEWARD_E2E = "1"
python -m unittest tests.test_e2e_production_smoke -v
```

验收输出必须证明：

- chat record 成功。
- life-events 读回成功。
- Reflection 请求返回 `intent=reflection`。
- Planning 请求返回 `intent=planning`，计划包含任务、开始时间、时长和难度。
- 使用真实 embedding，不得把 deterministic fallback 作为远程模型证据。

### P0-4：17:00 前完成交接

更新 `成员三/day06_handoff_03.md`，记录：

- 最新分支和 commit。
- API/schema/service 修改。
- 持久化失败语义。
- 真实数据库、embedding、Reflection、Planning 结果。
- 完整测试、E2E 测试和仍存在的外部阻塞。

### 成员3禁止事项

- 不新增 Agent、AgentState 字段、模型提供商或数据库 Schema。
- 不用 deterministic fallback 冒充生产模型验收。
- 不为绕过失败而恢复 `InMemoryMemoryService` 自动 fallback。

## 五、成员1协同支援（只做阻断 Demo 的最小改动）

成员1不承担新功能开发，只完成以下两个阻断项：

- `ChatHome.tsx` 请求失败时显示真实错误和重试，不再显示“我先帮你记下了”或“mock 回复”。
- `conversation_id` 在当前浏览器会话稳定，并显示 intent/extracted_events/request 状态。
- 使用 `getLifeEvents()` 的时间轴读取真实 API；保留 loading、empty、error、retry。
- 执行 frontend contract test、TypeScript/Vite build 和浏览器四步演示。

## 六、今日时间表与 Gate

| 时间 | Gate | 必须产出 |
|---|---|---|
| 10:00 | 环境 Gate | DSN/key 状态、migration/pgvector 健康检查 |
| 11:30 | 数据 Gate | 数据库集成 5/5 实跑通过 |
| 13:00 | API Gate | life-events、错误语义、planning 路由测试通过 |
| 15:00 | E2E Gate | chat 写入 → timeline 读回 → reflection → planning |
| 17:00 | 前端 Gate | contract/build/浏览器错误态通过 |
| 18:00 | Demo Freeze | 只修四步演示阻断问题，不再加需求 |
| 19:00 | Handoff | 成员2/3 handoff、脱敏证据、启动步骤齐全 |

## 七、统一验收命令

后端：

```powershell
cd backend
python -m unittest discover -s tests -p "test_*.py" -v
```

前端：

```powershell
cd frontend
node --test tests/contract.test.mjs
pnpm run build
```

最终通过标准：完整后端测试无代码失败；数据库 5 项不因缺 DSN/key 跳过；E2E 在真实环境执行；前端无 mock 成功提示；浏览器可连续完成四步 Demo。

## 八、今天明确不做

- Profile、DIY、首页任务的后端化。
- Redis 缓存、通知、移动端、部署平台、账号系统。
- 新 Agent、新 Prompt 体系、多模型路由、大型重构。
- 为了“测试全绿”而删除或弱化真实环境 Gate。
