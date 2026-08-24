# LifeAgent 每日开发进度记录

日期：2026-08-23

负责人：邓庥晗

------------------------------------------------------------------------

# 一、今日目标

- 统一 MemoryService 对外接口，完成 Fake/Mock 与 Tool 实现同步。
- 将真实记忆读写编排到 SQLTool、VectorSearchTool 和统一 LLMService 边界。
- 增加统一 embedding 调用接口。
- 实现第一版 ReflectionAgent，并接入 MasterAgent 的 reflection 路由。

------------------------------------------------------------------------

# 二、实际完成内容

## 完成模块

- MemoryService 接口统一为 `save_memory()`、`search_memory()`、`update_user_profile()`、`compress_memory()`。
- 新增 `ToolMemoryService`：保存事件走 SQLTool，向量记忆保存/检索走 VectorSearchTool，embedding 统一走 LLMService；未直接编写 SQL 或访问数据库。
- MemoryAgent 已停止调用旧的 `save_events()`，record_event 仅保存事件，query/reflection/planning 按需检索并写入 `retrieved_memories`。
- LLMService 增加 `embed_text(text: str) -> list[float]`；QwenProvider 使用 OpenAI-compatible embeddings 接口，默认模型为 `text-embedding-v3`，可由 `EMBEDDING_MODEL_NAME` 配置。
- 新增 ReflectionAgent 和外置 `reflection_prompt.md`。Agent 读取 `user_input`、`retrieved_memories`、`user_profile`、`extracted_events`，仅写入 `reflection_result`，输出 `status`、`problem`、`suggestion` 三个字段；无记忆、非法响应或 LLM 异常时降级为 `insufficient_data`。
- MasterAgent 的 reflection 路由已调整为：`MemoryAgent → ReflectionAgent → InteractionAgent`，其它 intent 路由保持不变。
- 修复 Mock Demo 学习事件抽取遗漏“数学”等前缀的问题。

## 修改文件

- `backend/services/memory_service.py`：统一接口，新增 ToolMemoryService，同步 Fake/Mock 实现。
- `backend/agents/memory_agent.py`：使用新接口，维护 `retrieved_memories`。
- `backend/agents/reflection_agent.py`、`backend/prompts/reflection_prompt.md`：新增复盘 Agent 与外置 Prompt。
- `backend/agents/master_agent.py`：接入 ReflectionAgent 路由。
- `backend/core/llm_service.py`、`backend/core/providers/qwen_provider.py`：增加 embedding 服务边界及 Qwen 实现。
- `backend/tests/test_memory_agent.py`、`test_memory_service.py`、`test_reflection_agent.py`、`test_master_agent_routing.py`：补充接口、异常、降级及路由测试。

------------------------------------------------------------------------

# 三、当前系统状态

## 已完成链路

- record_event：`LifeUnderstandingAgent → extracted_events → MemoryAgent → MemoryService → SQLTool / VectorSearchTool`
- query_memory / reflection：`memory_query → MemoryAgent → MemoryService → LLMService.embed_text → VectorSearchTool → retrieved_memories`
- reflection：`reflection → MemoryAgent → ReflectionAgent → reflection_result → InteractionAgent → assistant_response`

## 未完成模块

- 应用生产启动代码目前仍默认注入 `InMemoryMemoryService`；切换到 `ToolMemoryService` 还需要在启动组合根中注入已配置的 SQLTool、VectorSearchTool 和 LLMService。
- SQLTool、VectorSearchTool 的真实 PostgreSQL/pgvector 联调未完成，需成员二补齐实现并提供可用环境。
- `update_user_profile()` 已纳入接口并委托 SQLTool，但尚无对应的持久化 Tool 联调验收。

------------------------------------------------------------------------

# 四、遇到的问题

问题：直接从仓库根目录执行测试会出现模块导入错误。

原因：项目测试依赖 `backend` 作为工作目录。

解决方案：使用 `cd backend` 后执行 `..\\.venv\\Scripts\\python.exe -m unittest discover -s tests -p "test_*.py" -v`。

问题：数据库集成测试无法执行。

原因：本地未配置 `POSTGRES_DSN`、`REDIS_URL`，相关基础设施测试按设计跳过。

解决方案：保留 Mock/Fake 单元测试作为当前验收依据，待环境和 Tool 实现就绪后补做真实联调。

------------------------------------------------------------------------

# 五、接口变化记录

新增：`MemoryService.save_memory()`、`search_memory()`、`update_user_profile()`、`compress_memory()`；`LLMService.embed_text()`；`AgentState.reflection_result`。

修改：MemoryAgent 及 Fake/Mock 服务统一使用 `save_memory()`；reflection 路由增加 ReflectionAgent 节点。

删除：未删除 AgentState 字段或数据库 Schema；旧接口仅停止在新流程中使用。

------------------------------------------------------------------------

# 六、明日开发建议

下一步：与成员二联调 SQLTool、VectorSearchTool，完成 PostgreSQL/pgvector 上的 record/query/reflection 验收；在应用启动组合根注入 ToolMemoryService；配置 embedding 模型与运行环境后补跑集成测试。

优先级：P0

负责人：成员三负责 Agent/Service 侧联调；成员二负责 Tool 和数据库环境。

------------------------------------------------------------------------

# 七、Git 记录

Branch：当前工作分支为 `main`；建议后续整理为 `feature_day3_memory_reflection`。

Commit：本次改动尚未创建独立提交，需避免混入工作区已有的 Day1/Day2 修改后再提交。
