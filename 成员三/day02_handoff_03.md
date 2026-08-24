# LifeAgent 每日开发进度记录

日期：2026-08-22

负责人：邓庥晗

------------------------------------------------------------------------

# 一、今日目标

在不破坏 Day1 Agent 核心闭环的前提下，引入第一版 MemoryAgent 与 MemoryService 边界，扩展 MasterAgent 路由，并增强 LLM Provider 的 timeout、retry、响应解析和异常归一化能力，为 Day3 的 PostgreSQL/pgvector RAG 接入预留接口。

------------------------------------------------------------------------

# 二、实际完成内容

## 完成模块

- MemoryAgent：按 Intent 判断是否检索记忆；生成 memory_query；通过 MemoryService 搜索或保存事件；只更新 `retrieved_memories`。
- MemoryService 抽象及 Fake/Mock 实现：提供 `search_memory`、`save_events`、`compress_memory` 接口，支持本地确定性闭环和单元测试。
- MasterAgent Day2 路由：接入 `record_event`、`query_memory`、`reflection`、`planning`；Reflection/Planning 暂走 MemoryAgent 降级路径，未实现完整 Agent。
- LLM 可靠性增强：统一异常类型，增加 timeout、指数退避 retry（最多 3 次），兼容对象、字典、JSON 字符串和纯文本响应，并识别 HTML 错误页。
- Prompt 与结构化输出增强：继续使用外置 Prompt，补充多事件、时间模糊、query_memory 等场景约束。
- 测试与人工验收脚本：新增 MemoryAgent、MasterAgent 路由、LLM retry 测试及 Day2 人工闭环脚本。

## 修改文件

| 文件路径 | 修改内容 | 影响范围 |
|---|---|---|
| `backend/agents/memory_agent.py` | 新增记忆检索/事件保存 Agent 与 query 生成规则 | Memory 工作流 |
| `backend/services/memory_service.py` | 新增 Service 接口、FakeMemoryService、MockMemoryService | MemoryAgent 与存储工具边界 |
| `backend/agents/master_agent.py` | 接入 MemoryAgent 及 Day2 Intent 路由 | 核心 Agent 编排 |
| `backend/core/llm_service.py` | 增加 LLM 错误类型、环境配置 timeout/retry 参数 | 统一模型服务层 |
| `backend/core/providers/qwen_provider.py` | 增加请求超时、重试、退避及响应格式解析 | Qwen Provider |
| `backend/prompts/*.md` | 优化 Intent、事件抽取和交互 Prompt | 模型输入输出约束 |
| `backend/tests/test_memory_agent.py` | 新增 record/query/空结果/Service 异常测试 | MemoryAgent 单测 |
| `backend/tests/test_master_agent_routing.py` | 新增五类 Intent 路由及降级路径测试 | MasterAgent 路由测试 |
| `backend/tests/test_llm_retry.py` | 新增 retry、超时、HTML、非法响应测试 | LLM 可靠性测试 |
| `backend/tests/manual_day2_memory_flow.py` | 新增 Day2 本地闭环人工验收脚本 | 端到端验证 |

说明：以上 Day2 文件当前处于工作区未提交状态；未修改 FastAPI、Schema 或数据库实现边界。

------------------------------------------------------------------------

# 三、当前系统状态

## 已完成链路

```text
User Input
    ↓
MasterAgent
    ↓
LifeUnderstandingAgent（record_event 时）
    ↓
MemoryAgent（保存或检索）
    ↓
InteractionAgent
    ↓
assistant_response
```

`query_memory` 直接进入 MemoryAgent；`reflection`、`planning` 当前复用记忆检索后再交给 InteractionAgent 的临时降级路径；`casual_chat` 保持 Day1 路径。

## 未完成模块

- PostgreSQL 真实记忆表、pgvector 向量检索与持久化写入
- Redis 短期记忆策略
- ReflectionAgent、PlanningAgent 完整实现
- 真实备用模型与生产级观测指标
- Intent Classification 与 Life Event Extraction 合并请求的线上实施

------------------------------------------------------------------------

# 四、遇到的问题

问题：本地环境未安装 pytest，无法执行新增自动化测试套件。

原因：当前 Python 环境缺少 `pytest` 模块。

解决方案：已完成测试文件编写，并保留 `manual_day2_memory_flow.py` 供安装依赖后进行本地闭环验证；后续先安装开发测试依赖，再执行完整测试。

------------------------------------------------------------------------

# 五、接口变化记录

新增：

- `MemoryAgent.process(state)`、`MemoryAgent.build_memory_query(...)`
- `MemoryService.search_memory(...)`
- `MemoryService.save_events(...)`
- `MemoryService.compress_memory(...)`
- `FakeMemoryService`、`MockMemoryService`
- `LLMTimeoutError`、`LLMResponseError`

修改：

- `MasterAgent.process(state)` 增加 MemoryAgent 调度
- Qwen Provider 增加 `timeout`、`max_retries`、`retry_backoff` 配置

删除：

- 无

------------------------------------------------------------------------

# 六、明日开发建议

下一步：将 MemoryService 接到成员二提供的 SQLTool/VectorSearchTool，完成真实记忆写入与检索，并补齐 API 集成测试。

优先级：高

负责人：成员三与成员二联调

------------------------------------------------------------------------

# 七、Git 记录

Branch：`main`（建议后续切换或整理为 `feature/day2-memory-agent`）

Commit：尚未提交；建议拆分为：

- `feat(memory): add memory agent workflow`
- `feat(llm): add retry and timeout handling`
- `test(agent): extend routing and memory tests`

