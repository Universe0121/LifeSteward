# LifeSteward Day4 - 成员2 / 成员3联调总览

日期：2026-08-24

## Day4 核心原则

Day3 已经完成大量组件代码。Day4 不继续堆骨架，优先把真实链路接通。

### 成员2
负责 PostgreSQL、pgvector、migration、SQLTool、VectorSearchTool、user_profile Tool 缺口和真实数据库测试。

目标：`Tool 能写 -> 真实环境验证通过`。

### 成员3
负责 ToolMemoryService、生产依赖注入、Memory/Reflection 真实闭环、LLM Protocol 同步、PlanningAgent。

目标：`组件已经写好 -> 正式 API 真正在使用`。

## 冻结联调接口

```python
SQLTool.get_recent_events(...)
SQLTool.save_life_events(...)
SQLTool.update_user_profile(...)
VectorSearchTool.search_memories(...)
VectorSearchTool.save_memory(...)
```

## P0 验收

```text
POST /api/v1/chat
↓
MasterAgent
↓
MemoryAgent
↓
ToolMemoryService
↓
SQLTool / VectorSearchTool
↓
PostgreSQL / pgvector
```

必须真实跑通。

## P1

P0 通过后：

```text
planning
↓
MemoryAgent
↓
PlanningAgent
↓
InteractionAgent
```
