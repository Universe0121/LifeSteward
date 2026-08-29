# LifeAgent 周报总结与海报交接验收

日期：2026-08-29  
负责人：成员三  
交接对象：成员二、前端/移动端调用方

## 1. 交付范围

- 周报生成 API：`POST /api/v1/weekly-reports/generate`
- 周报列表 API：`GET /api/v1/weekly-reports`
- 周报海报 API：`GET /api/v1/weekly-reports/{report_id}/poster`
- 周报持久化表：`weekly_reports`
- 周报 Agent、确定性 SVG 海报、批量定时脚本和测试覆盖

本任务没有实现前端/移动端页面，也没有接入图片生成服务；海报是后端确定性 SVG。

## 2. API Schema

### 2.1 生成周报

`POST /api/v1/weekly-reports/generate`

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `user_id` | `int/string` | 是 | 用户 ID；服务层会转为字符串入库。 |
| `week_start` | `date/null` | 否 | ISO 日期，例如 `2026-08-17`；为空时生成最近一个已结束自然周。 |
| `timezone` | `string` | 否 | 默认 `Asia/Shanghai`；支持 IANA 时区名、`UTC`、`+08:00` 这类 offset。 |

示例请求：

```json
{
  "user_id": 10001,
  "week_start": "2026-08-17",
  "timezone": "Asia/Shanghai"
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `report_id` | `int` | 周报主键。 |
| `user_id` | `string` | 规范化后的用户 ID。 |
| `week_start` | `date` | 周一日期。 |
| `week_end` | `date` | 周日日期。 |
| `report_data` | `object` | 新版周报主体结构。 |
| `poster_url` | `string` | 海报相对路径，规则见第 3 节。 |
| `generated_at` | `datetime` | 生成/更新时刻。 |

示例响应：

```json
{
  "report_id": 12,
  "user_id": "10001",
  "week_start": "2026-08-17",
  "week_end": "2026-08-23",
  "report_data": {
    "overview": {
      "title": "2026-08-17 至 2026-08-23 周报",
      "theme": "学习 / 工作",
      "summary": "本周共记录 6 条事件，重心主要在学习。",
      "week_start": "2026-08-17",
      "week_end": "2026-08-23"
    },
    "activity_analysis": {
      "week_start": "2026-08-17",
      "week_end": "2026-08-23",
      "total_events": 6,
      "category_distribution": [
        {
          "category": "study",
          "category_label": "学习",
          "count": 2,
          "share": 33.3
        }
      ],
      "time_bands": {
        "morning": 1,
        "afternoon": 2,
        "evening": 2,
        "night": 1
      },
      "dominant_category": "study",
      "dominant_category_label": "学习",
      "summary": "时间结构以学习为主。",
      "trend_summary": "本周记录主要集中在学习，其次是工作。",
      "comparison_note": "未提供上周数据，仅保留本周结构分析。"
    },
    "section_reviews": [
      {
        "title": "工作与学习",
        "summary": "本周在工作与学习上共记录 3 条。",
        "points": ["代表记录：学习数学 2 小时"],
        "evidence": ["学习数学 2 小时"]
      }
    ],
    "highlights": [
      {
        "title": "学习高光",
        "summary": "学习数学 2 小时；情绪：focused；时间：08-18 09:00",
        "event_ids": [1],
        "event_type": "study",
        "emotion": "focused",
        "evidence": ["学习数学 2 小时"]
      }
    ],
    "completion": {
      "completed": ["工作与学习：本周在工作与学习上共记录 3 条。"],
      "unfinished": ["创作与分享：暂无明显记录"],
      "summary": "本周有 3 个模块出现记录，整体重心在学习。",
      "completion_rate": 0.6
    },
    "next_week_suggestions": ["继续保持学习的连续记录，看看趋势会不会更清晰。"],
    "summary": "本周共记录 6 条事件，重心主要在学习。",
    "stats": {
      "total_events": 6
    },
    "suggestions": ["继续保持学习的连续记录，看看趋势会不会更清晰。"]
  },
  "poster_url": "/api/v1/weekly-reports/12/poster",
  "generated_at": "2026-08-24T00:05:00Z"
}
```

兼容字段：`summary`、`stats`、`suggestions` 会从新版结构派生，供旧前端过渡使用；新客户端以 `report_data.overview`、`report_data.activity_analysis` 等字段为准。

### 2.2 查询历史周报

`GET /api/v1/weekly-reports?user_id=10001&limit=10`

Query 字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `user_id` | `string` | 是 | 用户 ID，不允许为空。 |
| `limit` | `int` | 否 | 默认 10；范围 1 到 100。 |

示例响应：

```json
{
  "items": [
    {
      "report_id": 12,
      "user_id": "10001",
      "week_start": "2026-08-17",
      "week_end": "2026-08-23",
      "report_data": {
        "overview": {
          "summary": "本周共记录 6 条事件。"
        },
        "activity_analysis": {},
        "section_reviews": [],
        "highlights": [],
        "completion": {},
        "next_week_suggestions": [],
        "stats": {},
        "suggestions": []
      },
      "poster_url": "/api/v1/weekly-reports/12/poster",
      "generated_at": "2026-08-24T00:05:00Z"
    }
  ],
  "count": 1
}
```

排序规则：按 `week_start DESC, report_id DESC` 返回。

### 2.3 获取海报

`GET /api/v1/weekly-reports/{report_id}/poster`

成功响应：

- HTTP `200`
- `Content-Type: image/svg+xml`
- Body 为可直接浏览和分享的 SVG 文本。

示例：

```text
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">...</svg>
```

### 2.4 相关现有 API

周报生成依赖已沉淀的生活事件，不改变现有聊天/时间轴契约：

- `POST /api/v1/chat`：写入生活事件、触发 Memory/Reflection/Planning 生产链路。
- `GET /api/v1/life-events?user_id=10001&days=7`：时间轴读取最近事件。

## 3. `poster_url` 规则

- 拼接函数：`WeeklyReportService.build_poster_url(report_id)`
- 固定格式：`/api/v1/weekly-reports/{int(report_id)}/poster`
- 返回的是相对路径，不包含域名、协议、前端路由前缀或签名参数。
- 客户端跨域部署时，应使用自己的 API base 拼成完整 URL，例如 `${API_BASE}${poster_url}`。
- 只有存在 `report_id` 时才生成 `poster_url`；`report_id` 会转成整数，避免 `12.0` 或字符串噪声进入 URL。
- `poster_url` 指向后端海报接口，接口返回 `image/svg+xml`。
- `poster_svg` 存在数据库字段 `weekly_reports.poster_svg` 中；读取海报时优先返回已存 SVG，如果旧数据没有 SVG，则由确定性模板基于周报数据即时渲染一次。

## 4. 空状态

### 4.1 周报列表为空

当用户没有历史周报：

```json
{
  "items": [],
  "count": 0
}
```

客户端建议显示“暂无周报”，并提供“先记录生活事件”的入口。

### 4.2 生成周报时本周无事件

`WeeklyReportAgent` 不调用 LLM，直接返回确定性空状态：

```json
{
  "overview": {
    "title": "2026-08-17 至 2026-08-23 周报",
    "theme": "暂无记录",
    "summary": "本周还没有记录，先把生活里发生的小事记下来。",
    "week_start": "2026-08-17",
    "week_end": "2026-08-23"
  },
  "activity_analysis": {
    "total_events": 0,
    "category_distribution": [],
    "time_bands": {
      "morning": 0,
      "afternoon": 0,
      "evening": 0,
      "night": 0
    },
    "summary": "本周暂无记录，无法分析时间结构。"
  },
  "section_reviews": [
    {
      "title": "健康与自律",
      "summary": "本周暂无相关记录。",
      "points": [],
      "evidence": []
    }
  ],
  "highlights": [],
  "completion": {
    "completed": [],
    "unfinished": ["健康与自律：暂无明显记录"],
    "summary": "本周尚未形成可复盘的记录。",
    "completion_rate": 0.0
  },
  "next_week_suggestions": [
    "先记录一条日常事件，给周报留下一点骨架。",
    "把睡眠、工作或学习里的一个片段写完整。",
    "尽量保留时间、地点和感受，后面更好回顾。"
  ]
}
```

空状态海报仍返回 200 和 SVG，SVG 中包含“本周还没有记录”。

### 4.3 时间轴为空

`GET /api/v1/life-events` 返回：

```json
{
  "items": [],
  "count": 0
}
```

周报调用方不要把时间轴空状态当作接口错误。

## 5. 错误状态

统一错误响应：

```json
{
  "success": false,
  "error_code": "INVALID_REQUEST",
  "message": "请求参数无效"
}
```

已覆盖/约定的错误：

| 场景 | HTTP | `error_code` | 说明 |
| --- | --- | --- | --- |
| 请求字段缺失、类型不合法、额外字段、query 参数越界 | 400 | `INVALID_REQUEST` | FastAPI validation handler 统一包成错误信封。 |
| `generate` 中 `user_id` 为空、`week_start` 非 ISO 日期、`timezone` 非法 | 400 | `INVALID_REQUEST` | Service 抛 `ValueError` 后由 API 转换。 |
| 海报 `report_id` 不存在 | 404 | `WEEKLY_REPORT_NOT_FOUND` | Body 为统一错误信封。 |
| Agent/持久化处理失败 | 500 | `AGENT_PROCESSING_ERROR` | 主要用于聊天链路。 |
| 未捕获异常 | 500 | `INTERNAL_SERVER_ERROR` | 不向客户端暴露内部堆栈。 |
| 定时脚本单个用户失败 | 进程继续 | result item `status=failed` | 不阻塞其他用户，日志记录 `error`。 |

LLM 返回非法 JSON、空响应、超时或普通运行时异常时，`WeeklyReportAgent` 会降级为代码计算出的确定性周报，不直接把 LLM 错误暴露给客户端。

## 6. 定时脚本

脚本入口：`backend/scripts/generate_weekly_reports.py`

本地手动执行：

```powershell
cd D:\生活管家\LifeSteward-main\LifeSteward-main\backend
.\.venv312\Scripts\python.exe scripts\generate_weekly_reports.py --timezone Asia/Shanghai
```

如使用类 Unix venv：

```bash
cd /path/to/LifeSteward-main/backend
./.venv/bin/python scripts/generate_weekly_reports.py --timezone Asia/Shanghai
```

Windows Task Scheduler 建议：

```text
Trigger: Weekly, Monday, 00:05, Asia/Shanghai
Program/script: D:\生活管家\LifeSteward-main\LifeSteward-main\backend\.venv312\Scripts\python.exe
Arguments: scripts\generate_weekly_reports.py --timezone Asia/Shanghai
Start in: D:\生活管家\LifeSteward-main\LifeSteward-main\backend
```

Linux cron 示例：

```cron
5 0 * * 1 cd /path/to/LifeSteward-main/backend && ./.venv/bin/python scripts/generate_weekly_reports.py --timezone Asia/Shanghai >> logs/weekly_reports.log 2>&1
```

必须环境变量：

| 变量 | 说明 |
| --- | --- |
| `POSTGRES_DSN` | PostgreSQL DSN，数据库需可用并已安装 pgvector。 |
| `LLM_PROVIDER` | `stepfun` 或 `qwen`；`.env.example` 默认 `stepfun`。 |
| `MODEL_NAME` | 文本生成模型名；`stepfun` 默认可用 `step-3.7-flash`，`qwen` 默认 `qwen-plus`。 |
| `STEP_API_KEY` | `LLM_PROVIDER=stepfun` 时用于文本生成。 |
| `STEP_BASE_URL` | `stepfun` 文本生成 base URL，默认 `https://api.stepfun.com/step_plan/v1`。 |
| `DASHSCOPE_API_KEY` | `qwen` 文本生成需要；`stepfun` 场景也需要它做 embedding。 |
| `DASHSCOPE_BASE_URL` | DashScope OpenAI-compatible base URL。 |
| `EMBEDDING_MODEL_NAME` | 默认 `text-embedding-v3`。 |
| `TEMPERATURE` | 默认 `0.7`。 |
| `LLM_TIMEOUT` | 默认 `30` 秒。 |
| `LLM_MAX_RETRIES` | 默认 `3`。 |
| `LLM_RETRY_BACKOFF` | 默认 `0.2` 秒。 |

可选验收环境变量：

| 变量 | 说明 |
| --- | --- |
| `LIFE_STEWARD_E2E=1` | 开启真实生产链路 E2E 测试。 |
| `LIFE_STEWARD_API_BASE` | 仿真数据脚本调用后端 API 的 base URL，默认 `http://127.0.0.1:8000`。 |
| `REDIS_URL` | Redis 健康检查使用；当前周报链路非强依赖。 |

## 7. 迁移编号

当前迁移顺序：

1. `backend/migrations/001_initial_memory_schema.sql`
   - 创建 `life_events`、`memories`、`user_profile`、`goals`、`plans`、`feedbacks`、`reflections`
   - 创建 pgvector extension：`CREATE EXTENSION IF NOT EXISTS vector`
2. `backend/migrations/002_weekly_reports.sql`
   - 创建 `weekly_reports`
   - 字段：`report_id`、`user_id`、`week_start`、`week_end`、`report_data`、`poster_svg`、`generated_at`
   - 唯一约束：`UNIQUE (user_id, week_start)`

幂等性说明：`SQLTool.save_weekly_report()` 使用 `ON CONFLICT (user_id, week_start) DO UPDATE`，同一用户同一周重复生成会更新原记录并保留同一个 `report_id`。

## 8. 测试结果

测试环境：Windows PowerShell，后端使用 `backend\.venv312\Scripts\python.exe`，测试日期 `2026-08-29`。

周报专项测试：

```powershell
cd D:\生活管家\LifeSteward-main\LifeSteward-main\backend
.\.venv312\Scripts\python.exe -m unittest tests.test_weekly_report_api tests.test_weekly_report_service tests.test_weekly_report_agent tests.test_weekly_poster_service tests.test_generate_weekly_reports_script -v
```

结果：17 tests，全部通过。  
备注：`test_run_weekly_reports_continues_after_one_user_fails_and_is_idempotent` 会打印模拟的 `LLM unavailable` 错误日志，这是测试“单用户失败不阻塞批处理”的预期分支。

后端全量测试：

```powershell
cd D:\生活管家\LifeSteward-main\LifeSteward-main\backend
.\.venv312\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```

默认未设置 `LIFE_STEWARD_E2E` 时，生产 E2E 会按设计跳过；本次已按验收要求开启环境变量重跑完整回归：

```powershell
cd D:\生活管家\LifeSteward-main\LifeSteward-main\backend
$env:LIFE_STEWARD_E2E="1"
.\.venv312\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```

结果：121 tests，全部通过，0 errors，0 failures，0 skipped。

- 已解决：`tests.test_database_integration.DatabaseIntegrationTestCase.test_vector_search_roundtrip`
  - 原失败点：真实 embedding HTTP 请求阶段，底层为 `WinError 10013`。
  - 复验方式：使用提升权限放开外部 HTTP 后重跑。
  - 复验结果：通过。
- 已解决：`tests.test_e2e_production_smoke.ProductionChainSmokeTest.test_web_demo_production_chain`
  - 原状态：默认未设置 `LIFE_STEWARD_E2E` 时跳过。
  - 复验方式：设置 `$env:LIFE_STEWARD_E2E="1"` 后跑完整回归。
  - 复验结果：通过，完整回归不再出现 skipped。

生产 E2E 补验：

```powershell
cd D:\生活管家\LifeSteward-main\LifeSteward-main\backend
$env:LIFE_STEWARD_E2E="1"
.\.venv312\Scripts\python.exe -m unittest tests.test_e2e_production_smoke -v
```

结果：1 test，通过；完整回归中也已执行该 E2E，未跳过。  
证据：`record_intent=record_event`，`database_life_event_id=100`，`life_events_api_matches=18`，`reflection_intent=reflection`，`reflection_pgvector_memories=5`，`planning_intent=planning`，`generated_plan_items=1`，`embedding_dimension=1024`，`pgvector_hits=3`。

真实周报 API 补验：

```powershell
cd D:\生活管家\LifeSteward-main\LifeSteward-main\backend
.\.venv312\Scripts\python.exe -c "from fastapi.testclient import TestClient; from main import app; client=TestClient(app); client.__enter__(); r=client.post('/api/v1/weekly-reports/generate', json={'user_id':10001,'week_start':'2026-08-24','timezone':'Asia/Shanghai'}); print(r.status_code, r.json().get('poster_url')); client.__exit__(None,None,None)"
```

结果：生成接口 HTTP `200`，`report_id=13`，`poster_url=/api/v1/weekly-reports/13/poster`，公开响应不含内部字段 `poster_svg`，`activity_analysis.total_events=48`；随后请求海报 URL 返回 HTTP `200`、`Content-Type: image/svg+xml`、SVG 长度 `8648`。

前端契约测试：

```powershell
cd D:\生活管家\LifeSteward-main\LifeSteward-main\frontend
npm.cmd test
```

结果：通过，输出 `frontend contract passed`。  
备注：直接执行 `npm test` 会被当前 PowerShell 执行策略拦截 `npm.ps1`，使用 `npm.cmd test` 可正常运行。

## 9. 真实 LLM / 数据库联调缺口

已验证：

- PostgreSQL 连接健康检查通过。
- pgvector extension 可用检查通过。
- `life_events`、`memories`、`weekly_reports` 等表存在性检查通过。
- SQLTool 生命周期测试通过，包括 life event、user profile、weekly report upsert。
- 周报 API、Service、Agent、Poster、定时脚本单测通过。
- 周报 Agent 已覆盖无事件、非法 JSON、LLM 超时/异常的确定性降级。

已补验：

- 真实 embedding 端到端已通过：提升权限放开外部 HTTP 后，`test_vector_search_roundtrip` 通过。
- 真实生产 E2E 已通过：聊天写入、时间轴回读、Reflection、Planning、pgvector 搜索链路均跑通。
- 周报生成真实链路已通过：`POST /api/v1/weekly-reports/generate` 成功调用真实 LLM/数据库并生成 SVG 海报 URL。

仍需前端/移动端补齐：

- 前端/移动端尚未接周报列表和海报页面：后端 API 已具备，现有网页契约测试只覆盖聊天和时间轴。
- 在非沙箱部署环境中，应确保定时任务运行账户具备访问 StepFun/DashScope 与 PostgreSQL 的网络权限；否则会复现 `WinError 10013` 类型的 socket 拒绝。

建议补验命令：

```powershell
cd D:\生活管家\LifeSteward-main\LifeSteward-main\backend
$env:LIFE_STEWARD_E2E="1"
.\.venv312\Scripts\python.exe -m unittest tests.test_database_integration tests.test_e2e_production_smoke -v
.\.venv312\Scripts\python.exe scripts\generate_weekly_reports.py --timezone Asia/Shanghai
```

后续上线前建议补录：

- 定时任务真实运行一次后的批处理日志。
- 前端/移动端消费 `GET /api/v1/weekly-reports` 和 `poster_url` 的截图或接口证据。
