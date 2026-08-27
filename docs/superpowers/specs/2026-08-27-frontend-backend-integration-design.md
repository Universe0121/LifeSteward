# LifeSteward 前后端联调设计

## 目标

在 GitHub 最新代码与本地前端真实 API 集成的基础上，建立可验证的前后端联调闭环，并在外部依赖缺失时给出明确状态，而不是伪造生产成功。

## 当前基线

- 后端 FastAPI 已提供 `POST /api/v1/chat` 与 `GET /api/v1/life-events`。
- 前端通过 `frontend/src/api.ts` 调用上述接口，开发环境由 Vite 将 `/api` 代理到 `http://localhost:8000`。
- 前端聊天页已具备会话 ID、加载态、错误态、重试和请求详情展示。
- 后端生产组合根依赖 PostgreSQL/pgvector、Redis（由基础设施服务使用）和 LLM Provider 配置。
- 当前仓库没有 `backend/.env`；真实 PostgreSQL、pgvector、Redis 和 LLM 凭据不能假定存在。

## 设计

### 1. 健康检查边界

新增 `GET /api/health`，返回稳定 JSON：

```json
{
  "status": "ok|degraded",
  "database": {"connected": true, "vector_extension_available": true},
  "llm": {"configured": true, "provider": "qwen"}
}
```

健康检查只报告配置与连接状态，不触发写入、不运行完整 Agent 链路、不泄露密钥。数据库连接失败或 LLM 未配置时返回 `degraded`，HTTP 仍使用 200，便于前端和部署探针读取详细状态。

### 2. 前端运行配置

保留 `VITE_API_BASE`，默认值为 `/api`。Vite 开发代理继续指向 `http://localhost:8000`。启动文档明确前后端分别从 `frontend/` 与 `backend/` 目录启动，以及真实联调所需的环境变量。

### 3. 契约与验证

- 后端单元测试覆盖健康检查的完整、降级和未初始化状态。
- 现有聊天、时间轴 API 契约测试继续作为回归门槛。
- 前端契约测试继续验证错误 envelope、请求路径、会话 ID 和时间轴调用。
- 若本机存在 PostgreSQL/pgvector、Redis 和 LLM 配置，额外运行生产冒烟测试；否则输出明确的缺口清单，不把跳过当作通过。

## 错误处理

- 健康检查内部异常被转换为可读的降级字段，不返回连接串、API Key 或完整堆栈。
- 业务接口仍沿用现有 `INVALID_REQUEST`、`AGENT_PROCESSING_ERROR` 与 `INTERNAL_SERVER_ERROR` 错误 envelope。
- 前端继续把后端 `message` 与 HTTP 状态组合成用户可见错误，并提供重试入口。

## 非目标

- 不自动创建 PostgreSQL、Redis 或 pgvector。
- 不提交真实密钥或本地 `.env`。
- 不在本轮新增认证、用户管理、实时流式响应或部署基础设施。

## 成功标准

1. `/api/health` 在依赖完整、依赖缺失和组合根未初始化时都返回符合契约的结果。
2. 前端生产构建和契约测试通过。
3. 后端相关单测通过；真实依赖缺失时报告具体变量/服务，而不是声称端到端已完成。
4. 工作区不包含冲突标记、真实凭据或被覆盖的同步前文件。
