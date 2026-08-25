# LifeSteward Day3 开发任务 - 成员3

日期：2026-08-25 至 2026-08-26  
负责人：邓庥晗  
角色：Production Workflow / E2E Owner

## 一、任务目标

以 GitHub `origin/main@5b26a77` 为后端事实基线，把已存在的 Production Wiring、Memory、Reflection、Planning 从单元测试状态推进为网页可验证的真实闭环。停止新增 Agent，专注生产入口、事件查询 API、失败语义和 E2E。

## 二、P0-1：基线集成与回归

1. 在包含成员1提交 `9c13e53` 的最新冲刺分支上开发。
2. 运行 79 项后端测试，确认合并没有破坏 Agent 路由。
3. 检查正式 `/api/v1/chat` 只使用 `CompositionRoot.master_agent -> ToolMemoryService`；`/api/v1/mock-chat` 不得成为正式网页默认路径。
4. 与成员2确认 `POSTGRES_DSN`、migration、embedding 模型和向量维度。

## 三、P0-2：新增时间轴真实查询 API

新增冻结接口：

```http
GET /api/v1/life-events?user_id=10001&days=7
```

响应：

```json
{
  "items": [
    {
      "life_event_id": 1,
      "user_id": "10001",
      "conversation_id": "demo_xxx",
      "event_type": "study",
      "event_content": "今天学习数学2小时，有点累",
      "event_time": "2026-08-25T10:00:00+08:00",
      "emotion": "tired",
      "importance_score": 0.7
    }
  ],
  "count": 1
}
```

实现边界：

```text
FastAPI route
-> LifeEventQueryService
-> CompositionRoot.sql_tool
-> SQLTool.get_recent_events()
-> PostgreSQL
```

要求：

- `user_id` 必填，`days` 限制为 1 至 30。
- API 不直写 SQL，不直接创建新的数据库客户端。
- 使用应用启动时已经组装的共享依赖。
- 增加 schema、service、route 测试：正常结果、空结果、非法参数、Tool 异常。
- 不改现有 `POST /api/v1/chat` 公共字段。

## 四、P0-3：消除“数据库失败却提示保存成功”

当前 `MemoryAgent.process()` 会吞掉 record_event 的持久化异常，随后 InteractionAgent 可能回复“已经记录”。本次必须修复：

- record_event 写入失败时，错误传到 Service/API 边界并返回标准错误；网页不得显示保存成功。
- query/reflection/planning 的检索失败可以安全降级，但日志或响应状态必须可定位，不能制造历史事实。
- 增加回归测试，明确验证 record_event 保存异常不会得到成功文案。
- 不新增大而泛化的错误框架。

## 五、P0-4：真实 Reflection 与 Planning 验收

使用成员2提供的真实数据库和正式模型配置完成：

1. 先通过网页写入睡眠、效率、压力三条历史。
2. 输入“最近为什么学习效率下降？”。
3. 证明 `MemoryAgent -> embed_text -> VectorSearchTool -> ReflectionAgent -> InteractionAgent` 已运行，回答不得出现数据库中不存在的事实。
4. 输入“根据我最近的状态，帮我安排明天的学习计划”。
5. 证明 `MemoryAgent -> PlanningAgent -> InteractionAgent` 已运行，计划包含任务、开始时间和时长。

若无法从公共响应看到内部状态，允许在开发日志记录 intent、检索条数和 Agent 路由；严禁把完整 embedding、API key、DSN 写入日志。

## 六、P0-5：自动化 E2E 冒烟

新增一个最小脚本或测试，依次完成：

- 调用 chat 写入事件。
- 调用 life-events 读回相同内容。
- 调用 chat 请求 reflection。
- 调用 chat 请求 planning。

脚本对真实外部环境可使用显式开关；无环境时允许跳过，但第二天 Gate B 必须在已配置环境中实跑一次并保存输出摘要。

## 七、与成员1、成员2的交付点

- 14:00 前冻结 life-events API 和样例响应，交给成员1。
- 成员1发现前端字段不够时，先在 API schema 适配，禁止让前端直接依赖数据库内部字段。
- pgvector、migration、Tool SQL 问题交成员2；Agent/Service/API 问题由本人成交。
- 第二天 15:00 后只接受阻断四步演示的问题。

## 八、禁止事项

- 不新增 NotificationAgent、ProfileAgent、模型提供商或 AgentState 字段。
- 不重写现有 Planning/Reflection，除非真实 E2E 暴露阻断缺陷。
- 不把 Fake/InMemory 作为正式 `/api/v1/chat` 的自动 fallback。
- 不扩展到 Profile、DIY、首页任务的后端化。

## 九、完成标准与交接

- `/api/v1/chat` 正式链路使用真实 ToolMemoryService。
- `/api/v1/life-events` 从真实 PostgreSQL 返回刚写入的事件。
- record_event 持久化失败不会伪成功。
- reflection 和 planning 均从网页成功执行。
- 79 项既有测试与新增测试全部通过；数据库测试不得因 DSN 跳过。
- 提交真实 E2E 摘要、分支和 commit。

更新 `成员三/day03_handoff_03.md`，按 Day4 handoff 格式记录生产依赖、真实数据库结果、pgvector 检索、Planning/Reflection、测试、未解决问题和 Git 信息。

推荐提交：

```text
feat(api): expose persisted life events for timeline
fix(memory): surface record persistence failures
test(e2e): cover web demo production chain
```
