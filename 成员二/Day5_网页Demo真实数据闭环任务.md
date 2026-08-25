# LifeSteward Day3 开发任务 - 成员2

日期：2026-08-25 至 2026-08-26  
负责人：李浩天  
角色：Persistence / RAG Demo Gate Owner

## 一、任务目标

把 Day4 handoff 中“代码已完成但真实数据库未验收”收口为可重复执行的真实环境。两天内保证网页 Demo 的事件写入、事件读回、向量保存和相似度检索都来自 PostgreSQL/pgvector。

## 二、P0-1：当天中午前解除数据库阻塞

1. 从最新冲刺分支开始，不使用旧下载目录。
2. 配置本机或团队共享的 PostgreSQL + pgvector；提供脱敏后的连接说明。
3. 在 `backend/.env` 配置 `POSTGRES_DSN`，不得提交真实密钥。
4. 执行 `backend/migrations/001_initial_memory_schema.sql`。
5. 确认 `life_events`、`memories`、`user_profile`、`goals`、`plans`、`feedbacks`、`reflections` 七张表存在。

验收：

```powershell
cd backend
python -m unittest tests.test_database_integration -v
```

5 项测试必须实际执行并通过，不得 skip。

## 三、P0-2：冻结网页联调所需 Tool 行为

保持并验证：

```python
SQLTool.save_life_events(...)
SQLTool.get_recent_events(user_id: str, days: int = 7)
VectorSearchTool.save_memory(...)
VectorSearchTool.search_memories(user_id: str, query_embedding: list[float], top_k: int = 5)
```

重点检查：

- `user_id=10001` 与其他用户数据隔离。
- `get_recent_events()` 返回网页时间轴需要的 `life_event_id`、`event_type`、`event_content`、`event_time`、`emotion`、`importance_score`。
- 真实 embedding 维度与已写入向量一致；不得用 `[0.1, 0.2, 0.3]` 作为最终网页验收证据。
- 向量检索结果包含 `memory_id`、`memory_content`、`similarity_score`。
- 若向量维度不一致，只做兼容本次模型的最小 migration；先通知成员3，不擅自重构 Schema。

## 四、P0-3：提供三条可复现验收数据

通过正式 `/api/v1/chat` 写入，不直接用 SQL 伪造：

- 最近三天每天只睡5小时。
- 最近学习效率很差。
- 压力比较大。

然后协助成员3验证：

- `life_events` 能按用户和时间范围读回。
- `memories` 有非空 embedding。
- 查询“最近为什么学习效率下降？”返回真实相似记忆。
- 数据库连接失败、migration 缺失、vector 扩展缺失和维度错误能够被明确区分。

## 五、P0-4：交付启动与清理说明

新增或更新数据库启动文档，必须给出：

- 安装/启动 PostgreSQL + pgvector 的最短步骤。
- migration 命令。
- 健康检查和测试命令。
- 仅删除 `user_id=10001` 演示数据的安全清理 SQL；禁止整库清空。
- Windows 下从仓库根和 `backend/` 目录运行时的准确路径。

## 六、与成员3、成员1的交付点

- 12:00 前向成员3确认 DSN 可用、migration 已执行、数据库测试 5/5 通过。
- 成员3新增查询 API 时，只提供 Tool 契约和真实返回样例；不要跨界修改 React。
- 成员1联调时间轴遇到数据字段问题时，优先保持现有 Tool 字段，由 API 适配，不修改前端去猜数据库字段。
- 若成员3在真实 pgvector 上阻塞超过 60 分钟，立即结对定位并提交最小修复。

## 七、禁止事项

- 不做 Redis、监控平台、数据库大重构、Profile 新系统。
- 不在 `.env.example` 写真实密钥或真实 DSN 密码。
- 不用 Mock/固定向量作为最终验收。
- 不修改 Agent、Prompt、React 页面，除非明确接手一个已阻塞超过 60 分钟的 P0 修复。

## 八、完成标准与交接

完成必须同时满足：

- 数据库集成测试 5/5 实跑通过。
- 浏览器写入后 `life_events` 与 `memories` 均有相同用户的真实记录。
- pgvector 查询返回真实 `similarity_score`。
- 提供脱敏 SQL/截图证据与可重复的环境步骤。
- 完整后端测试通过；仅 Redis 环境测试允许跳过。

更新 `成员二/day03_handoff_02.md`，严格记录分支、提交、测试总数、数据库测试结果、环境阻塞和与成员3的联调结论。

推荐提交：

```text
docs(db): add reproducible demo database setup
test(db): verify real demo persistence roundtrip
fix(rag): align demo embedding dimensions
```
