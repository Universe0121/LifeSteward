# LifeSteward Day4 开发任务 - 成员3

日期：2026-08-24  
负责人：邓庥晗  
角色：Agent Workflow / Production Integration Owner

## 一、Day4 总目标

Day3 已完成 ToolMemoryService、MemoryAgent 接口收口、`LLMService.embed_text()`、ReflectionAgent 和 reflection 路由。

但当前生产聊天链路仍有关键问题：`process_chat_message()` 默认创建 `MasterAgent()`，而 `MasterAgent()` 默认注入 `InMemoryMemoryService()`。因此正式 `/api/v1/chat` 还没有自动使用 PostgreSQL / pgvector。

Day4 第一目标：让正式 API 真正使用 `ToolMemoryService`，完成真实 record / query / reflection 闭环。P0 完成后，再进入 PlanningAgent。

## 二、最高优先级规范

必须优先阅读：
- `项目开发参考文件/变量名规范/ai_rules.md`
- `architecture.md`
- `agent_protocol.md`
- `workflow_design.md`
- `LLM_Protocol.md`
- `总体命名规范.md`

保持：`API -> Service -> Agent -> Tool -> Database`。
Agent 间只能通过 `AgentState` 通信。

## 三、P0：修复生产依赖注入

当前：

```text
POST /api/v1/chat
↓
process_chat_message()
↓
MasterAgent()
↓
InMemoryMemoryService()
```

Day4 改为：

```text
POST /api/v1/chat
↓
ChatService
↓
MasterAgent
↓
MemoryAgent
↓
ToolMemoryService
├── SQLTool
├── VectorSearchTool
└── LLMService
↓
PostgreSQL / pgvector
```

## 四、P0：建立 Composition Root

不要每次请求都重新构造整套模型和数据库依赖。

在应用启动阶段组装：
- `LLMService`
- `DatabaseClient`
- `SQLTool`
- `VectorSearchTool`
- `ToolMemoryService`
- `MasterAgent`

推荐原则：
1. `main.py` 只负责应用启动和 HTTP。
2. 依赖组装可放在 `core/` 下独立 factory。
3. Chat Service 接收已经构造好的 MasterAgent。
4. 测试仍可注入 Fake / Mock。

禁止：`API -> Database`、`API -> VectorSearchTool` 业务调用、`Agent -> Database`。

## 五、P0：真实 record_event 闭环

输入：`今天学习数学2小时，有点累`

必须经过：

```text
/api/v1/chat
↓
MasterAgent
↓
LifeUnderstandingAgent
↓
extracted_events
↓
MemoryAgent
↓
ToolMemoryService
↓
SQLTool
↓
PostgreSQL
```

同时 `event_content -> LLMService.embed_text() -> VectorSearchTool -> memories`。

正式 API 链路禁止用 `InMemoryMemoryService` 完成验收。

## 六、P0：真实 query_memory / reflection 闭环

先写入：
- 最近三天每天只睡5小时
- 最近学习效率很差
- 压力比较大

再输入：`最近为什么学习效率下降？`

必须经过：

```text
intent = reflection
↓
MemoryAgent
↓
ToolMemoryService.search_memory()
↓
LLMService.embed_text()
↓
VectorSearchTool.search_memories()
↓
retrieved_memories
↓
ReflectionAgent
↓
reflection_result
↓
InteractionAgent
↓
assistant_response
```

`retrieved_memories` 必须来自真实 pgvector。

## 七、P0：修正规范文件与代码不一致

代码已经增加：

```python
LLMService.embed_text(...)
```

但最高优先级 `项目开发参考文件/变量名规范/LLM_Protocol.md` 仍只声明 `generate()`。

Day4 必须同步更新该协议文件，把已经确定的 embedding 边界写入规范。不要扩展与 Day4 无关的新模型接口。

## 八、P1：PlanningAgent 第一版

只有 P0 真实闭环通过后再开始。

创建：
- `backend/agents/planning_agent.py`
- `backend/prompts/planning_prompt.md`
- `backend/tests/test_planning_agent.py`

必要时才创建 `backend/services/planning_service.py`，禁止制造空壳 Service。

PlanningAgent 必须：

```python
def process(self, state: AgentState) -> AgentState:
    ...
```

输入从 AgentState 读取：`user_input`、`user_profile`、`current_goal`、`retrieved_memories`、`reflection_result`。
只写入 `generated_plan`，禁止新增 AgentState 字段。

冻结结构：

```json
[
  {
    "task_name": "数学复习",
    "start_time": "09:00",
    "duration_minutes": 60,
    "difficulty": 0.5
  }
]
```

## 九、P1：Planning Prompt 与路由

创建外置 `planning_prompt.md`，要求参考用户画像、历史记忆、reflection_result，输出结构化、可执行计划，不制造历史事实。

完成后将 MasterAgent 的 planning 路由从：

```text
MemoryAgent
```

升级为：

```text
MemoryAgent
↓
PlanningAgent
↓
InteractionAgent
```

其它 intent 行为不能被破坏。

## 十、测试要求

新增/完善：
- `backend/tests/test_production_wiring.py`
- `backend/tests/test_memory_service.py`
- `backend/tests/test_master_agent_routing.py`
- `backend/tests/test_planning_agent.py`

Production wiring 至少验证：生产 factory 创建 `ToolMemoryService`、不默认回落 InMemory、依赖注入正确、测试仍能显式使用 Fake。

PlanningAgent 至少验证：正常结果、字段完整、非法 JSON 降级、LLM exception、不修改无关 AgentState、MasterAgent 路由顺序。

## 十一、与成员2边界

成员3负责：`backend/agents/`、`backend/services/memory_service.py`、生产依赖组装、LLM 协议、PlanningAgent、Prompt、Agent/Service 测试。

成员2负责：`backend/core/database.py`、`backend/tools/sql_tool.py`、`backend/tools/vector_search_tool.py`、migration、真实 PostgreSQL/pgvector 环境。

除非双方明确协调，不跨边界修改。

## 十二、最终验收

A. 输入“今天学习数学2小时，有点累”，正式 API 经过真实 Agent Workflow 写入真实 PostgreSQL 的 `life_events + memories`。

B. 输入“最近为什么学习效率下降？”，真实 pgvector 检索到 `retrieved_memories`，再经过 ReflectionAgent 生成 `reflection_result -> assistant_response`。

C. 如果 P0 完成，输入“根据我最近的状态，帮我安排明天的学习计划”，完成 `planning -> MemoryAgent -> PlanningAgent -> generated_plan -> InteractionAgent`。

## 十三、Day4 明确不做

不进入 NotificationAgent、移动端、Kubernetes、Redis 复杂策略、多模型路由重构、Timeline 完整 API、大规模 Profile 系统、数据库 Schema 重构。

## 十四、Git

建议分支：`feature_day4_production_planning`

建议提交：
```text
fix(app): wire tool memory service into production
docs(llm): align embedding protocol
test(app): cover production dependency wiring
feat(planning): add planning agent
test(planning): cover planning workflow
```

## 十五、交接文件

新增：`成员三/day04_handoff_03.md`

必须记录：生产依赖注入方式、是否仍存在 InMemory fallback、record_event 真实 DB 结果、reflection 真实 pgvector 结果、LLM Protocol 同步状态、PlanningAgent 状态、MasterAgent planning 路由、测试结果、与成员2联调问题、Branch、Commit。
