# LifeSteward Day3 开发任务 - 成员3

日期：2026-08-23

## 角色定位

Day3 负责：

> Agent Workflow / Memory Orchestration Owner

今天核心目标：

1. 将 MemoryService 从 Fake/Mock 接到真实 Tool
2. 收口 MemoryService 接口
3. 建立统一 embedding 调用边界
4. 实现第一版 ReflectionAgent

---

## 一、最高优先级约束

必须阅读：

- `项目开发参考文件/变量名规范/ai_rules.md`
- `architecture.md`
- `agent_protocol.md`
- `workflow_design.md`
- `intent_definition.md`
- `LLM_Protocol.md`
- `总体命名规范.md`

所有 Agent 必须：

```text
输入 AgentState
输出 AgentState
```

禁止：

- Agent 直接访问 PostgreSQL
- Agent 直接访问 pgvector
- Agent 内直接初始化模型客户端
- Python 内硬编码 Prompt
- 自行扩展 AgentState 字段

---

## 二、Day3 总目标

将当前：

```text
MemoryAgent
↓
FakeMemoryService
```

升级为：

```text
MemoryAgent
↓
MemoryService
↓
SQLTool / VectorSearchTool
↓
真实数据
```

并实现：

```text
reflection
↓
MemoryAgent
↓
ReflectionAgent
↓
InteractionAgent
```

---

## 三、P0：MemoryService 接口收口

当前实现存在：

```text
save_events()
search_memory()
compress_memory()
```

而冻结命名规范要求 MemoryService 使用：

```text
save_memory()
search_memory()
update_user_profile()
compress_memory()
```

Day3 要完成接口统一。

### 主要修改

- `backend/services/memory_service.py`
- `backend/agents/memory_agent.py`
- `backend/tests/test_memory_agent.py`
- 相关 MasterAgent / Service tests

要求：

- 不再让新代码继续依赖旧的 `save_events()` 命名
- Fake / Mock 实现同步修改
- 所有测试同步修改
- 不改变 AgentState 字段

---

## 四、P0：真实 MemoryService

MemoryService 负责组合：

```text
SQLTool
VectorSearchTool
```

但不要直接写 SQL。

### record_event

目标链路：

```text
LifeUnderstandingAgent
↓
extracted_events
↓
MemoryAgent
↓
MemoryService
↓
SQLTool
↓
PostgreSQL
```

### query_memory / reflection

目标链路：

```text
memory_query
↓
embedding
↓
VectorSearchTool
↓
pgvector
↓
retrieved_memories
↓
AgentState
```

---

## 五、P0：Embedding 模型边界

当前统一模型接口只有：

```python
LLMService.generate(...)
```

真实 RAG 需要 embedding。

如果 Day3 增加 embedding 能力，必须优先修改统一协议：

- `backend/core/llm_service.py`
- `backend/core/providers/qwen_provider.py`
- `项目开发参考文件/变量名规范/LLM_Protocol.md`

建议增加统一能力，例如：

```python
embed_text(text: str) -> list[float]
```

具体最终函数名必须先与规范命名对齐。

禁止：

```python
MemoryAgent -> OpenAI(...)
MemoryAgent -> Qwen(...)
MemoryService -> 自建第三方客户端
```

必须保持：

```text
MemoryService
↓
统一模型服务边界
↓
Provider
```

---

## 六、P0：ReflectionAgent 第一版

创建：

```text
backend/agents/reflection_agent.py
backend/prompts/reflection_prompt.md
backend/tests/test_reflection_agent.py
```

ReflectionAgent 输入仍是完整 `AgentState`。

允许读取：

- `user_input`
- `retrieved_memories`
- `user_profile`
- `extracted_events`

只负责写入：

```text
reflection_result
```

第一版结构保持：

```json
{
  "status": "high_pressure",
  "problem": "计划过重",
  "suggestion": "减少任务量并优先恢复睡眠"
}
```

禁止 ReflectionAgent：
- 写数据库
- 保存长期记忆
- 修改 `assistant_response`
- 创建计划

---

## 七、P0：MasterAgent Reflection 路由

修改：

```text
backend/agents/master_agent.py
```

将当前 reflection 临时链路：

```text
reflection
↓
MemoryAgent
↓
InteractionAgent
```

升级为：

```text
reflection
↓
MemoryAgent
↓
ReflectionAgent
↓
InteractionAgent
```

保持其它 intent 不被破坏。

---

## 八、P1：Reflection Prompt

创建：

```text
backend/prompts/reflection_prompt.md
```

Prompt 至少要求模型：

- 基于真实 retrieved_memories
- 不凭空制造历史事实
- 输出结构化结果
- 明确 `status`
- 明确 `problem`
- 明确 `suggestion`

禁止在 Python 中写完整 Prompt 字符串。

---

## 九、测试要求

新增/完善：

```text
backend/tests/test_memory_agent.py
backend/tests/test_reflection_agent.py
backend/tests/test_master_agent_routing.py
backend/tests/test_memory_service.py
```

至少覆盖：

### Memory

- record_event
- query_memory
- 空检索
- Tool 异常
- Service 异常
- user_id 传递正确

### Reflection

- 有记忆时生成 reflection_result
- 无记忆时可以安全降级
- 不修改无关 AgentState 字段
- LLM 异常路径
- MasterAgent 路由顺序正确

统一执行：

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py" -v
```

---

## 十、PlanningAgent 暂不作为必交

Day3 不要求完整实现 PlanningAgent。

PlanningAgent 作为：
- Day3 Stretch Goal
- Day4 P0

今天优先保证 Memory + Reflection 链路真实可运行。

---

## 十一、禁止修改

今天不要主动修改：

- 数据库 Schema
- migration SQL
- `backend/tools/sql_tool.py` 的 SQL 实现
- `backend/tools/vector_search_tool.py` 的 DB 实现
- 前端 Demo

Tool 接口问题与成员2同步，不直接跨边界修改数据库实现。

---

## 十二、验收标准

先写入历史：

```text
最近三天都只睡了5小时
今天学习效率很差
```

再输入：

```text
最近为什么学习效率下降？
```

要求：

```text
intent = reflection
↓
MemoryAgent
↓
真实 pgvector 检索
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

---

## 十三、Git

分支：

```text
feature_day3_memory_reflection
```

推荐提交：

```text
refactor(memory): align memory service contract
feat(memory): connect memory service to persistence tools
feat(llm): add embedding service boundary
feat(reflection): add reflection agent workflow
test(agent): cover memory and reflection flow
```

---

## 十四、交接文件

当天结束必须新增：

```text
成员三/day03_handoff_03.md
```

记录：
- MemoryService 最终接口
- Embedding 调用方式
- ReflectionAgent 输入输出
- MasterAgent 路由变化
- 测试结果
- 与成员2联调状态
- 未完成问题
- Branch
- Commit
