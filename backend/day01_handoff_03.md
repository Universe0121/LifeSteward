
日期：2026-08-22

负责人：邓庥晗

------------------------------------------------------------------------

# 一、今日目标

- 完成 Master Agent、Life Understanding Agent、Interaction Agent 最小闭环。
- 接入统一 LLMService，并预留、验证千问模型调用能力。
- 使用真实模型验证意图识别、生活事件拆解和最终自然语言回复。

------------------------------------------------------------------------

# 二、实际完成内容

## 完成模块

- 1. 定义`AgentState`，作为所有 Agent 之间唯一数据载体，统一输入输出协议。
2. 实现多枚举意图；`MasterAgent`接收`AgentState`，完成意图判断、子 Agent 调度路由，最终流转至交互 Agent。
3. `LifeUnderstandingAgent`，用户自然语言解析为结构化事件列表`extracted_events`，支持单输入输出多条事件。
4. `InteractionAgent`，读取完整`AgentState`上下文生成面向用户的`assistant_response`，具备降级容错。
5. 全部 Prompt 外置`.md`文件，代码不硬编码提示词。
6. `LLMService`统一收口模型请求；实现 Qwen 千问适配器；通过`.env`管理 API 密钥、接口地址、模型参数；Agent 不直接初始化模型，遵守编码约束。
7. 提供人工验收脚本，完成真实模型闭环验证；编写单元测试覆盖核心流程。


## 修改文件

文件路径：`backend/agents/state.py`

修改内容：定义统一 `AgentState`，包含 `user_id`、`conversation_id`、`user_input`、`intent`、`extracted_events`、`retrieved_memories`、`user_profile`、`current_goal`、`generated_plan`、`reflection_result`、`assistant_response`。

影响范围：所有 Agent 的统一输入和输出协议。

文件路径：`backend/agents/intent.py`

修改内容：定义 `record_event`、`query_memory`、`reflection`、`planning`、`update_profile`、`casual_chat` 等 Intent。

影响范围：Master Agent 的意图判断和工作流路由。

文件路径：`backend/agents/master_agent.py`

修改内容：接收 `AgentState`、识别 Intent、按意图调用专业 Agent，并将结果交给 Interaction Agent。

影响范围：核心 Agent 调度入口。

文件路径：`backend/agents/life_understanding_agent.py`

修改内容：调用统一模型服务，将用户输入转换为 `extracted_events`；兼容多事件、缺失字段、重要程度归一化和原文保留。

影响范围：生活信息结构化能力。

文件路径：`backend/agents/interaction_agent.py`

修改内容：根据 `AgentState` 生成唯一面向用户的 `assistant_response`，并提供降级回复。

影响范围：聊天回复出口。

文件路径：`backend/core/llm_service.py`

修改内容：建立统一模型接口、全局配置入口和基于环境变量的 Qwen Provider 工厂。

影响范围：所有 Agent 的模型调用入口。

文件路径：`backend/core/providers/qwen_provider.py`

修改内容：接入千问兼容接口；兼容标准对象、字典和纯字符串响应；检测错误的 HTML 页面响应。

影响范围：千问真实模型调用和响应解析。

文件路径：`backend/prompts/intent_classification_prompt.md`

修改内容：补充生活事件优先判定规则和复合输入示例。

影响范围：Intent 分类准确率。

文件路径：`backend/prompts/life_understanding_prompt.md`

修改内容：定义生活事件字段、支持的事件类别和非核心类别简单文字归档规则。

影响范围：生活事件抽取格式和边界。

文件路径：`backend/prompts/interaction_prompt.md`

修改内容：定义朋友兼秘书式回复风格，以及记录确认和缺失信息追问规则。

影响范围：最终回复风格。

文件路径：`backend/.env`、`backend/.env.example`

修改内容：配置 `qwen`、模型名、温度、API Key 和兼容接口地址；真实密钥仅保存在 `.env`。

影响范围：本地模型运行配置。

文件路径：`backend/requirements.txt`、`backend/.gitignore`

修改内容：增加模型 SDK 和环境变量加载依赖；忽略 `.env`、虚拟环境和 Python 缓存。

影响范围：开发环境和密钥安全。

文件路径：`backend/tests/test_core_agent_flow.py`、`backend/tests/test_llm_provider.py`

修改内容：覆盖核心闭环、Intent 路由、事件解析、Qwen 请求格式及多种响应格式。

影响范围：自动化回归验证。

文件路径：`backend/tests/manual_llm_connection.py`、`backend/tests/manual_agent_flow.py`

修改内容：增加真实模型连接测试和 UTF-8 核心 Agent 闭环测试脚本。

影响范围：人工验收和接口联调。
------------------------------------------------------------------------

# 三、当前系统状态

## 已完成链路

User Input

↓

Master Agent（Intent 判断与路由）

↓

Life Understanding Agent（结构化生活事件）

↓

Interaction Agent（最终自然语言回复）

↓

assistant_response

真实测试输入：`今天学习数学2小时，很累，昨晚睡了6小时`

真实测试结果：

- Intent 正确识别为 `record_event`。
- 拆解出一条学习事件和一条睡眠事件。
- 正确保留学习时长、睡眠时长、情绪和 `source_text`。
- 最终回复正确确认记录并给出朋友式关怀。

## 未完成模块

- Memory Agent、Redis 短期记忆和 PostgreSQL/pgvector 持久化。
- Reflection Agent、Planning Agent 和计划动态调整。
- FastAPI `/api/v1/chat` 接口与 Service 层业务编排。
- Todo、日程、提醒、历史记录和复盘页面。
- LLM 重试、备用模型、超时控制和统一错误返回格式。

------------------------------------------------------------------------

# 四、遇到的问题

问题：千问调用最初返回字符串，Provider 按标准对象读取 `choices` 时发生异常。

原因：当前第三方兼容网关返回格式与标准 OpenAI ChatCompletion 不完全一致。

解决方案：Qwen Provider 同时兼容标准对象、字典、JSON 字符串和纯文本字符串。

问题：模型请求返回第三方网关首页 HTML。

原因：`DASHSCOPE_BASE_URL` 缺少 `/v1` API 路径。

解决方案：将地址改为 `https://llm.goaichat.top/v1`，并增加 HTML 响应检测和明确错误提示。

问题：PowerShell 管道内联 Python 时，中文输入被错误编码，导致意图误判。

原因：管道传输未稳定保持 UTF-8 编码。

解决方案：新增 UTF-8 文件 `manual_agent_flow.py`，通过文件方式执行真实中文闭环测试。

问题：完整 Agent 链路真实调用耗时较长。

原因：一次输入需要串行执行 Intent、事件抽取、最终回复三次模型调用，并经过第三方网关。

解决方案：当前先完成正确性验证；后续增加超时、重试、观测和可并行/可合并调用评估。

------------------------------------------------------------------------

# 五、接口变化记录

新增：

- `LLMService.generate(prompt, variables)` 统一模型调用协议。
- `configure_llm_service_from_environment()` 环境配置入口。
- `QwenProvider` 千问模型适配器。
- `MasterAgent.process(state)` 核心工作流入口。
- `LifeUnderstandingAgent.process(state)` 生活事件抽取入口。
- `InteractionAgent.process(state)` 最终回复入口。
- `manual_llm_connection.py` 和 `manual_agent_flow.py` 人工验收脚本。

修改：

- Intent Prompt 增加生活事件优先级和复合输入规则。
- 生活事件增加 `event_time`、`emotion`、`impact`、`importance_score`、`source`、`source_text`。
- Qwen 响应解析支持多种兼容格式。

删除：

- OpenAI Provider 和通用 OpenAI-compatible Provider，仅保留 Qwen Provider。

------------------------------------------------------------------------

# 六、明日开发建议

下一步：

- 增加 FastAPI `/api/v1/chat` 和 `chat_service.py`，将当前 Agent 闭环接入 HTTP 接口。
- 为真实 Qwen 调用增加超时、三次重试和统一错误格式。
- 设计 Memory Agent 与 Memory Service 的最小接口，但暂不让 Agent 直接访问数据库。
- 增加更多真实语句测试：多事件、时间模糊、信息缺失、普通聊天、复盘和计划请求。
- 评估将 Intent 判断与事件抽取合并，减少一次模型调用和响应时间，但需保持 Agent 职责边界清晰。

优先级：

1. API 与 Service 层接入。
2. 模型错误处理和超时重试。
3. 扩充真实输入测试集。
4. Memory Agent 接口设计。

负责人：成员三负责核心 Agent 和模型调用链；API、数据库模块按团队分工协作。

------------------------------------------------------------------------

# 七、Git记录

Branch：尚未建立 Git 仓库。

Commit：提交。
## Day2 真实模型闭环验收补充（2026-08-22）

- `py -3.12 -m unittest discover -s tests -v`：37 个测试通过，2 个基础设施检查因未配置 PostgreSQL/Redis 连接串而跳过。
- `tests/manual_agent_flow.py`：真实模型 Day2 三场景验收通过。
  - 学习记录场景识别为 `record_event`，成功抽取事件并生成回复。
  - 学习效率场景识别为 `reflection`，成功检索历史事件并生成反思回复。
  - 压力调整场景识别为 `query_memory`，成功检索并生成无匹配记忆时的解释回复。
- `QwenProvider` 已支持 timeout、max_retries、retry_backoff 及统一异常类型；retry 单元测试通过。
- 当前真实 MemoryService 仍为 Mock/Fake；PostgreSQL/pgvector 持久化和真实 ChatService/MemoryService 联调仍待后续完成。
