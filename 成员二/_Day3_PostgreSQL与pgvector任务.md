# LifeSteward Day3 开发任务 - 成员2

日期：2026-08-23

## 角色定位

Day3 负责：

> Persistence / RAG Infrastructure Owner

今天的核心不是继续增加骨架，而是把现有 `SQLTool` / `VectorSearchTool` 从 Stub 变成真实 PostgreSQL / pgvector 能力。

---

## 一、最高优先级约束

必须优先阅读：

- `项目开发参考文件/变量名规范/ai_rules.md`
- `architecture.md`
- `Schema目录设计.md`
- `总体命名规范.md`
- `项目开发参考文件/双层数据库.png`
- `项目开发参考文件/新数据结构.png`
- `项目开发参考文件/RAG流程设计.png`

必须遵守：

```text
Service
↓
Tool
↓
Database
```

禁止：

```text
Agent -> Database
API -> Database
```

---

## 二、Day3 总目标

完成真实数据能力：

```text
MemoryService
↓
SQLTool
↓
DatabaseClient
↓
PostgreSQL
```

以及：

```text
query_embedding
↓
VectorSearchTool
↓
pgvector
↓
retrieved_memories
```

---

## 三、P0：数据库 Schema Gate

在开始写真实 SQL 前，先建立并冻结：

```text
backend/database_schema.md
backend/migrations/
```

第一版 migration 建议：

```text
backend/migrations/001_initial_memory_schema.sql
```

数据库字段必须以项目参考文件为准。

禁止：
- 因为代码方便自行新增字段
- 先 CREATE TABLE，再补文档
- 直接在数据库里手工改结构却不留下 migration

---

## 四、P0：SQLTool 实装

### 修改文件

- `backend/core/database.py`
- `backend/tools/sql_tool.py`

### 必须真实实现

```python
get_recent_events(
    user_id: str,
    days: int = 7
) -> list[dict]
```

以及现有事件写入接口。

要求：

- 使用 `DatabaseClient`
- 使用参数化 SQL
- 按 `user_id` 隔离
- 正确提交事务
- 数据库异常必须可被上层识别
- 不在 Tool 内处理 AgentState

---

## 五、P0：VectorSearchTool 实装

修改：

```text
backend/tools/vector_search_tool.py
```

真实实现：

```python
search_memories(
    user_id: str,
    query_embedding: list[float],
    top_k: int = 5
)
```

以及：

```python
save_memory(...)
```

要求：

- 使用 pgvector
- 按 `user_id` 过滤
- 支持 `top_k`
- 返回 `similarity_score`
- 空结果返回 `[]`
- 禁止调用 LLM
- 禁止在 Tool 中自行生成 embedding

返回数据字段遵循冻结命名，例如：

```json
{
  "memory_id": 1,
  "memory_content": "用户晚上学习效率较低",
  "similarity_score": 0.86
}
```

---

## 六、P1：基础设施错误处理

检查并完善：

```text
backend/core/database.py
```

至少覆盖：

- DSN 缺失
- PostgreSQL 无法连接
- pgvector 扩展不存在
- SQL 执行异常

错误信息要可供 Service 层统一封装。

---

## 七、测试要求

新增：

```text
backend/tests/test_sql_tool.py
backend/tests/test_vector_search_tool.py
backend/tests/test_database_integration.py
```

至少覆盖：

### SQLTool

- 正常写入
- 正常读取
- `user_id` 隔离
- 时间范围过滤
- 空结果
- DB 异常

### VectorSearchTool

- 正常向量检索
- `top_k`
- `user_id` 隔离
- 空结果
- similarity score
- pgvector 不可用

统一执行：

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py" -v
```

---

## 八、禁止修改

今天不要主动修改：

- `backend/agents/master_agent.py`
- `backend/agents/memory_agent.py`
- `backend/agents/reflection_agent.py`
- `backend/services/memory_service.py`
- `backend/prompts/`
- `backend/static/`

Tool 接口如果需要调整，先和成员3确认，不跨层直接改 Agent。

---

## 九、验收标准

必须现场证明：

```text
SQLTool.save...
↓
PostgreSQL
↓
SQLTool.get_recent_events()
↓
读回刚刚真实写入的数据
```

以及：

```text
query_embedding
↓
VectorSearchTool.search_memories()
↓
pgvector
↓
返回真实 memories
```

Day3 结束后，`SQLTool` / `VectorSearchTool` 不应再只是固定返回：

```text
[]
None
```

---

## 十、Git

分支：

```text
feature_day3_persistence
```

推荐提交：

```text
docs(db): add initial database schema
feat(db): add initial memory migration
feat(tool): implement postgres event persistence
feat(tool): implement pgvector memory search
test(db): add persistence integration tests
```

---

## 十一、交接文件

当天结束必须新增：

```text
成员二/day03_handoff_02.md
```

记录：
- 数据库结构
- migration
- Tool 接口
- 实际测试数据
- pgvector 检索结果
- 未完成问题
- Branch
- Commit
