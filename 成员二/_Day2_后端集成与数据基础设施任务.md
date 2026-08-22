# LifeAgent Day2 开发任务 - 成员二（后端集成与数据基础设施）

## 一、Day1 当前基线

成员二 Day1 已完成：

- `backend/main.py`
- `POST /api/v1/chat`
- `/docs`
- Chat Request / Response Schema
- `process_chat_message()` Service 入口
- `AgentState` 基础定义
- Chat Schema 与 Service 单元测试

成员三 Day1 已完成可运行的核心 Agent 与模型调用链：

- `MasterAgent`
- `LifeUnderstandingAgent`
- `InteractionAgent`
- `LLMService`
- `QwenProvider`
- Prompt 外置
- 真实千问调用验证

因此 Day2 不再重复开发 Agent 核心逻辑。

---

# 二、Day2 总目标

成员二今天的主任务是：

> **把 Day1 的 FastAPI / Service 骨架与成员三已经完成的真实 Agent 链路正式接通，并建立 Memory 模块后续接入所需的数据基础设施。**

Day2 结束时，至少实现：

```text
POST /api/v1/chat
        ↓
ChatService
        ↓
MasterAgent
        ↓
LifeUnderstandingAgent
        ↓
InteractionAgent
        ↓
ChatResponse
```

并为 Day3 的 Memory / RAG 接入准备好 PostgreSQL + pgvector + Redis 的连接层和基础 Tool 接口。

---

# 三、今天必须完成的开发内容

## 任务 1：接入真实 MasterAgent

### 目标

将当前 `chat_service.py` 中的占位调用替换为真实 Agent 链路。

### 负责文件

```text
backend/services/chat_service.py
backend/main.py
backend/schemas/chat_schema.py
backend/tests/test_chat_service.py
```

### 要求

`process_chat_message()` 必须：

1. 接收 ChatRequest
2. 构造统一 `AgentState`
3. 调用真实 `MasterAgent.process(state)`
4. 从最终 State 中读取：
   - `assistant_response`
   - `intent`
   - `extracted_events`
5. 转换成标准 ChatResponse

### 禁止

- API Route 直接实例化或调用 LLM
- API Route 直接调用数据库
- 在 `chat_service.py` 内写 Prompt
- 重新实现一套 MasterAgent

---

# 四、统一 AgentState 初始化

Day2 需要补全 Service 对 AgentState 的初始化逻辑。

建议初始化：

```python
state = {
    "user_id": str(request.user_id),
    "conversation_id": request.conversation_id,
    "user_input": request.user_input,
    "intent": "",
    "extracted_events": [],
    "retrieved_memories": [],
    "user_profile": {},
    "current_goal": {},
    "generated_plan": [],
    "reflection_result": {},
    "assistant_response": ""
}
```

不得自行增加新的 State 字段。

如确需新增字段，必须先同步架构负责人。

---

# 五、API 错误处理

## 必须完成

将 `/api/v1/chat` 的异常响应统一。

统一错误结构：

```json
{
  "success": false,
  "error_code": "AGENT_PROCESSING_ERROR",
  "message": "..."
}
```

至少覆盖：

- Agent 执行异常
- LLM 调用异常
- 非法请求
- Service 内部异常

## 注意

今天只建立统一错误出口。

具体 LLM Retry / Fallback 逻辑由成员三负责，不在成员二范围内重复实现。

---

# 六、数据基础设施：建立连接层，不做业务逻辑

Day2 开始准备 Memory 阶段所需基础环境。

## 需要完成

### PostgreSQL / pgvector

建立：

```text
backend/core/database.py
```

或者项目现有数据库连接目录中的等价文件。

目标：

- 能从 `.env` 读取数据库配置
- 能建立 PostgreSQL 连接
- 能验证 pgvector 扩展可用
- 不在 Agent 中直接操作数据库

### Redis

建立：

```text
backend/core/redis_client.py
```

目标：

- 能从 `.env` 读取 Redis 配置
- 能建立连接
- 提供 health check

---

# 七、Tool 层骨架

今天只建立接口骨架，不实现完整 RAG。

建议：

```text
backend/tools/
├── sql_tool.py
└── vector_search_tool.py
```

## SQLTool

预留：

```python
get_recent_events(user_id, days)
save_life_events(events)
```

## VectorSearchTool

预留：

```python
search_memories(user_id, query_embedding, top_k)
save_memory(memory)
```

今天可以先用 stub / mock。

禁止：

- 在 Tool 中写 Agent 推理
- 在 Tool 中调用 Prompt
- 在 Agent 中写 SQL

---

# 八、测试要求

今天至少补充以下测试。

## 1. Chat Service 集成测试

测试：

```text
ChatRequest
    ↓
ChatService
    ↓
MasterAgent
    ↓
ChatResponse
```

可以 mock LLM。

## 2. API 测试

测试：

```text
POST /api/v1/chat
```

确认：

- HTTP 200
- `intent` 存在
- `assistant_response` 存在
- `extracted_events` 为 list

## 3. Database Health Test

如果数据库环境已就绪：

- PostgreSQL connection
- pgvector extension
- Redis ping

---

# 九、今天明确不开发的内容

以下内容不属于成员二 Day2 范围：

- `LifeUnderstandingAgent` 业务逻辑
- `InteractionAgent` 业务逻辑
- Intent Prompt
- Qwen Provider 内部逻辑
- Reflection Agent
- Planning Agent
- 前端页面
- Memory RAG 排序算法
- Memory Compression Prompt
- 用户画像生成逻辑

避免修改成员三负责的核心 Agent 文件。

---

# 十、与成员三的接口边界

成员二提供：

```text
HTTP/API
↓
ChatService
↓
AgentState 初始化
↓
MasterAgent 调用入口
```

成员三提供：

```text
MasterAgent
↓
LifeUnderstandingAgent
↓
MemoryAgent（Day2 新增）
↓
InteractionAgent
↓
LLMService
```

双方统一通过 `AgentState` 协作。

---

# 十一、Day2 验收标准

## 必须通过

输入：

```json
{
  "user_id": 10001,
  "conversation_id": "conv_day2_001",
  "user_input": "今天学习数学2小时，很累"
}
```

HTTP：

```text
POST /api/v1/chat
```

返回至少包含：

```json
{
  "assistant_response": "...",
  "intent": "record_event",
  "extracted_events": [...]
}
```

并满足：

- Swagger 可调用
- Service 不再是占位实现
- API → Service → MasterAgent 链路真实贯通
- PostgreSQL / Redis 连接层至少完成骨架
- Tool 层接口骨架建立

---

# 十二、今日提交建议

建议 Branch：

```text
feature/day2-backend-integration
```

建议 Commit：

```text
feat(api): integrate chat service with agent workflow
feat(core): add database and redis connection layer
test(api): add chat integration tests
```

---

# 十三、Day2 结束必须更新交接文档

新建：

```text
day02_handoff_member2.md
```

必须记录：

1. 今日实际完成内容
2. 新增 / 修改文件
3. 当前可运行链路
4. 数据库与 Redis 是否连通
5. 尚未完成的接口
6. 当前 Bug
7. 与成员三联调结果
8. Day3 建议开发内容
9. Git Branch / Commit

**任何未完成内容不得只口头说明，必须写入交接文档。**
