# LifeAgent Day2 开发任务 - 成员三（Memory Agent 与模型链路增强）

## 一、Day1 当前基线

Day1 已完成：

- 统一 `AgentState`
- Intent 枚举
- `MasterAgent`
- `LifeUnderstandingAgent`
- `InteractionAgent`
- `LLMService`
- `QwenProvider`
- Prompt 外置
- `.env` 模型配置
- 核心单元测试
- 真实千问模型闭环验证

当前真实链路：

```text
User Input
    ↓
MasterAgent
    ↓
LifeUnderstandingAgent
    ↓
InteractionAgent
    ↓
assistant_response
```

成员二已经具备：

- FastAPI
- `/api/v1/chat`
- ChatService
- Chat Schema

因此 Day2 不再重复开发 API 框架。

---

# 二、Day2 总目标

成员三今天的主任务是：

> **在不破坏 Day1 核心闭环的前提下，引入 Memory Agent 的第一版能力，同时强化 LLM 调用的可靠性，为 Day3 的真实 PostgreSQL / pgvector RAG 接入做好准备。**

Day2 目标链路：

```text
User Input
    ↓
MasterAgent
    ↓
LifeUnderstandingAgent
    ↓
MemoryAgent
    ↓
InteractionAgent
    ↓
assistant_response
```

其中 MemoryAgent 今天必须具备明确接口，但允许先使用 mock MemoryService / mock retrieval data。

---

# 三、任务 1：开发 MemoryAgent

## 文件

```text
backend/agents/memory_agent.py
```

## 核心职责

MemoryAgent 负责：

1. 根据当前 `AgentState` 判断是否需要记忆检索
2. 构造 `memory_query`
3. 调用 MemoryService
4. 将结果写入：

```python
state["retrieved_memories"]
```

5. 不直接访问数据库
6. 不直接执行 SQL
7. 不直接调用 pgvector

---

# 四、MemoryAgent 输入输出冻结

## 输入

必须使用统一 AgentState。

主要读取：

```text
user_id
user_input
intent
extracted_events
```

## 输出

只更新：

```text
retrieved_memories
```

必要时可基于已有规范生成待保存 memory 对象，但不得新增未确认的 AgentState 字段。

---

# 五、MemoryService 调用接口约定

成员三今天负责明确 MemoryAgent 所需要的 Service API。

建议接口：

```python
class MemoryService:

    def search_memory(
        self,
        user_id: str,
        memory_query: str,
        top_k: int = 5
    ) -> list:
        ...

    def save_events(
        self,
        user_id: str,
        events: list
    ):
        ...

    def compress_memory(
        self,
        events: list
    ):
        ...
```

注意：

- 如果成员二尚未完成真实数据库 Tool，可以使用 FakeMemoryService / MockMemoryService。
- 不允许为了赶进度让 `MemoryAgent` 直接操作数据库。
- `MemoryAgent` 与真实数据库之间必须保留 Service / Tool 边界。

---

# 六、MasterAgent 路由扩展

在现有 MasterAgent 中接入 MemoryAgent。

至少支持：

## record_event

```text
LifeUnderstandingAgent
↓
MemoryAgent
↓
InteractionAgent
```

## query_memory

```text
MemoryAgent
↓
InteractionAgent
```

## reflection

Day2 暂不实现 ReflectionAgent，但路由应保持可扩展。

允许：

```text
MemoryAgent
↓
InteractionAgent
```

作为临时降级链路。

## planning

Day2 不实现 PlanningAgent。

不得为了今天闭环而写大量 Planning 占位业务。

---

# 七、Memory Query 生成规则

需要形成第一版明确规则。

示例：

用户：

```text
最近为什么学习效率下降？
```

Memory Query：

```text
用户最近学习效率下降相关的历史事件、压力状态、睡眠情况和有效调整经验
```

用户：

```text
我以前压力大的时候怎么调整比较有效？
```

Memory Query：

```text
用户过去压力较大时期采取过的调整措施及其结果
```

今天先保证 Memory Query 生成稳定、可测试。

复杂检索排序算法留到后续。

---

# 八、任务 2：LLM 调用可靠性增强

Day1 已发现真实模型调用存在：

- 第三方兼容接口响应格式不一致
- HTML 错误页
- 多次串行模型调用耗时较长

Day2 需要补齐基础可靠性。

## 必须完成

在统一 LLMService / Provider 层实现：

- timeout
- retry
- 明确异常类型
- 统一错误消息

建议：

```text
最多重试 3 次
```

注意：

Fallback model 如果当前没有第二模型配置，可以只预留接口，不强制当天实现真实备用模型。

---

# 九、减少重复模型调用的评估

Day1 当前一次 record_event 可能包含：

1. Intent 判断
2. 事件抽取
3. Interaction 回复

共三次模型调用。

Day2 要做一次技术评估：

## 评估问题

是否可以将：

```text
Intent Classification
+
Life Event Extraction
```

合并成一次结构化模型请求？

## 今天要求

不是必须上线。

必须输出结论到交接文档：

- 是否值得合并
- 预计降低多少调用
- 对 Agent 职责边界的影响
- 是否建议 Day3 / Day4 实施

除非测试充分，否则今天不要贸然破坏现有稳定链路。

---

# 十、Prompt 与结构化输出增强

今天允许优化：

```text
intent_classification_prompt.md
life_understanding_prompt.md
interaction_prompt.md
```

但必须遵循：

- Prompt 继续外置
- 不在 Python 中硬编码
- 每次修改记录原因
- 不修改已经冻结的字段命名

重点验证：

- 多事件输入
- 时间模糊
- 普通聊天
- query_memory
- reflection 请求
- planning 请求

---

# 十一、测试要求

至少新增以下测试。

## 1. MemoryAgent 单元测试

覆盖：

- record_event
- query_memory
- 无检索结果
- MemoryService 异常

## 2. MasterAgent 路由测试

覆盖：

```text
record_event
query_memory
reflection
planning
casual_chat
```

对于尚未实现的 Reflection / Planning，检查是否正确走降级路径。

## 3. LLM Retry 测试

模拟：

- 第一次失败，第二次成功
- 连续失败达到最大重试
- HTML 响应
- 非法 JSON / 字符串响应

## 4. 真实人工测试

至少测试：

```text
今天学习数学2小时，很累
```

```text
最近为什么学习效率越来越低？
```

```text
我以前压力大的时候有什么有效的调整办法？
```

---

# 十二、今天明确不开发的内容

以下内容不属于成员三 Day2 范围：

- FastAPI 路由重构
- API Schema 大改
- PostgreSQL 建表
- pgvector SQL
- Redis Client
- Reflection Agent 完整实现
- Planning Agent 完整实现
- 前端页面
- Notification
- 用户画像完整更新算法

数据库连接和 Tool 基础设施由成员二负责。

---

# 十三、与成员二的接口边界

成员三负责：

```text
MasterAgent
LifeUnderstandingAgent
MemoryAgent
InteractionAgent
LLMService
Prompt
Agent 单元测试
```

成员二负责：

```text
FastAPI
ChatService
Schema
Database connection
Redis connection
SQLTool / VectorSearchTool 基础设施
API 集成测试
```

双方连接点：

```text
ChatService
    ↓
MasterAgent.process(state)
```

以及：

```text
MemoryAgent
    ↓
MemoryService / Tool Interface
```

不得跨边界直接修改对方模块，除非联调时双方确认。

---

# 十四、Day2 验收标准

## 核心链路

至少本地测试通过：

```text
User Input
↓
MasterAgent
↓
LifeUnderstandingAgent
↓
MemoryAgent
↓
InteractionAgent
↓
assistant_response
```

Memory 可以先由 MockService 提供。

## Query Memory

输入：

```text
我以前压力大的时候怎么调整比较有效？
```

系统应：

1. 识别为 `query_memory`
2. 调用 MemoryAgent
3. 生成 memory_query
4. 将检索结果写入 `retrieved_memories`
5. InteractionAgent 基于检索结果回复

## 可靠性

LLM 失败时：

- 有 timeout
- 有 retry
- 最终失败产生清晰异常
- 不因 Provider 返回 HTML / 字符串而直接崩溃

---

# 十五、今日提交建议

建议 Branch：

```text
feature/day2-memory-agent
```

建议 Commit：

```text
feat(memory): add memory agent workflow
feat(llm): add retry and timeout handling
test(agent): extend routing and memory tests
```

---

# 十六、Day2 结束必须更新交接文档

新建：

```text
day02_handoff_member3.md
```

必须记录：

1. 今日实际完成内容
2. 新增 / 修改文件
3. 当前 Agent 调用链
4. MemoryAgent 当前能力
5. Mock 与真实服务的边界
6. LLM Retry / Timeout 实现情况
7. 当前 Bug 和性能问题
8. Intent + Event Extraction 合并评估结论
9. 与成员二联调结果
10. Day3 推荐任务
11. Git Branch / Commit

**未完成事项必须显式写入交接文档，保证 Day3 可以直接接续。**
