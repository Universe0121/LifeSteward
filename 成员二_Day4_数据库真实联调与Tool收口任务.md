# LifeSteward Day4 开发任务 - 成员2

日期：2026-08-24  
负责人：李浩天  
角色：Persistence / RAG Infrastructure Owner

## 一、Day4 总目标

Day3 已完成 PostgreSQL / pgvector Tool 层代码。Day4 不再扩充骨架，目标是把“代码已实现”推进为“真实数据库环境可运行、可验证、可供生产 MemoryService 使用”。

## 二、最高优先级规范

开发前必须重新阅读：
- `项目开发参考文件/变量名规范/ai_rules.md`
- `architecture.md`
- `总体命名规范.md`
- `backend/database_schema.md`
- `backend/migrations/001_initial_memory_schema.sql`

必须保持：`Agent -> Service -> Tool -> Database`。
禁止：`Agent -> PostgreSQL`、`API -> PostgreSQL`、`Tool -> LLM`。

如数据库字段发生变化，必须更新 `database_schema.md`、创建新的 migration，并通知所有成员同步。不要直接篡改旧 migration 来掩盖结构变化。

## 三、P0：真实 PostgreSQL + pgvector 环境验收

Day3 handoff 中真实集成测试因为未配置 `POSTGRES_DSN` 被跳过。Day4 必须完成真实环境验证。

要求：
1. 配置 `POSTGRES_DSN`。
2. 确认 PostgreSQL 可连接。
3. 确认 pgvector 扩展可用。
4. 执行 `backend/migrations/001_initial_memory_schema.sql`。
5. 验证 `life_events`、`memories`、`user_profile`、`goals`、`plans`、`feedbacks`、`reflections` 表存在。
6. 运行真实数据库集成测试，不能因缺少 `POSTGRES_DSN` 而跳过。

必须证明两条 round-trip：

```text
SQLTool.save_life_events()
↓
PostgreSQL
↓
SQLTool.get_recent_events()
↓
读取刚刚写入的数据
```

```text
VectorSearchTool.save_memory()
↓
PostgreSQL / pgvector
↓
VectorSearchTool.search_memories()
↓
返回带 similarity_score 的真实结果
```

## 四、P0：补齐 SQLTool.update_user_profile()

当前 `ToolMemoryService.update_user_profile()` 已调用 `SQLTool.update_user_profile()`，但 SQLTool 目前没有该方法。Day4 必须修复这一接口断点。

主要修改：
- `backend/tools/sql_tool.py`
- `backend/tests/test_sql_tool.py`

优先使用当前已有 `user_profile(user_id, profile_data, updated_at)` 表，不要无理由新增字段。

建议接口：

```python
def update_user_profile(self, user_id: str, user_profile: dict) -> None:
    ...
```

要求：参数化 SQL、按 `user_id` 隔离、使用 UPSERT、JSONB 存储、更新 `updated_at`。

至少测试：首次创建、已有用户更新、用户隔离、空 profile、DB exception。

## 五、P1：检查 Memory 与 Event 来源关联

当前 `memories` 表已有 `source_event_id`。检查真实保存链路是否能保留事件来源关系。

本项不要直接跨边界修改成员3的 `MemoryService`。如果当前 Tool 接口不足，先在 handoff 中写明：需要的输入、输出、兼容方案、受影响文件，再和成员3协商。

## 六、P1：数据库错误定位

至少能区分：
- `POSTGRES_DSN` 未配置
- PostgreSQL 无法连接
- pgvector 扩展不存在
- migration 未执行
- SQL 执行失败
- 向量维度错误

不要引入大型监控框架。

## 七、测试 Gate

在 `backend/` 下执行：

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

Day4 的关键不是“测试文件存在”，而是至少一次真实 PostgreSQL + pgvector 验证通过。

## 八、与成员3的冻结接口

成员2保证以下能力稳定：

```python
SQLTool.get_recent_events(...)
SQLTool.save_life_events(...)
SQLTool.update_user_profile(...)
VectorSearchTool.search_memories(...)
VectorSearchTool.save_memory(...)
```

不要主动修改：
- `backend/agents/`
- `backend/services/memory_service.py`
- `backend/agents/master_agent.py`
- `backend/prompts/`

## 九、最终验收

场景1：真实写入“今天学习数学2小时，有点累”，数据库能看到 `life_events` 与对应 memory 数据。

场景2：使用真实 embedding 查询，`VectorSearchTool.search_memories()` 返回真实 `memory_id`、`memory_content`、`similarity_score`，禁止使用固定 Mock 数据验收。

## 十、Git

建议分支：`feature_day4_db_integration`

建议提交：
```text
fix(tool): add user profile persistence
test(db): verify real postgres round trip
test(rag): verify pgvector retrieval integration
docs(db): document day4 database setup
```

## 十一、Day4 明确不做

不负责 PlanningAgent、ReflectionAgent、MasterAgent 路由、前端、Prompt、API、Redis 复杂缓存、新数据库架构重构。

## 十二、交接文件

新增：`成员二/day04_handoff_02.md`

必须记录：POSTGRES_DSN 状态、migration 状态、PostgreSQL/pgvector 状态、真实测试结果、`update_user_profile()` 完成情况、Tool 最终接口、与成员3联调结果、未解决问题、Branch、Commit。
