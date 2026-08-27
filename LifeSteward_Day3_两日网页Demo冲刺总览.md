# LifeSteward Day3：两日网页 Demo 全链路冲刺总览

日期：2026-08-25 至 2026-08-26  
总目标：两天内交付可现场演示的网页端第一版 Demo，真实跑通聊天记录、数据库持久化、向量检索、复盘、计划和时间轴读回。

## 一、当前真实基线

- GitHub `origin/main` 最新提交：`5b26a77`。
- 成员2已完成 PostgreSQL/pgvector Tool、migration、`SQLTool.update_user_profile()`；真实数据库仍未验收，因为 `POSTGRES_DSN` 未配置。
- 成员3已完成 `ToolMemoryService` 生产注入、ReflectionAgent、PlanningAgent 和 MasterAgent 路由；后端测试为 `Ran 79 tests, OK (skipped=7)`，其中 5 项数据库集成测试因缺少 `POSTGRES_DSN` 跳过。
- 成员1网页增强已在本地提交 `9c13e53`；前端 contract test 通过，使用本地 TypeScript/Vite 直接构建通过。
- `9c13e53` 与 `origin/main` 可自动合并，当前没有文本冲突。
- 当前网页聊天已请求真实 `/api/v1/chat`，但失败时会自动显示 mock 成功文案；时间轴与画像仍读取本地 JSON，不能证明数据库闭环。

## 二、两日 P0 闭环定义

```text
React 网页聊天
-> POST /api/v1/chat
-> MasterAgent
-> LifeUnderstanding / Memory / Reflection / Planning Agent
-> ToolMemoryService
-> SQLTool / VectorSearchTool
-> PostgreSQL + pgvector
-> GET /api/v1/life-events
-> React 时间轴显示刚写入的真实事件
```

现场必须依次演示：

1. 输入“今天学习数学2小时，有点累”。
2. PostgreSQL 中新增对应 `life_events`，pgvector `memories` 中新增向量记忆。
3. 切换时间轴页面，无需改代码即可看到刚记录的事件。
4. 输入“最近为什么学习效率下降？”，回答必须经过真实 pgvector 检索和 ReflectionAgent。
5. 输入“根据我最近的状态，帮我安排明天的学习计划”，回答必须经过 PlanningAgent。
6. 数据库不可用时网页必须明确报错，禁止伪装成“已经记录成功”。

## 三、责任分配

| 负责人 | P0 所有权 | 禁止分散精力 |
|---|---|---|
| 成员2 | PostgreSQL/pgvector 环境、migration、真实 round-trip、数据库验收证据 | Redis、监控平台、Schema 重构 |
| 成员3 | 生产 API/Agent/Service 全链路、事件查询 API、保存失败可见、反思与计划验收 | 新 Agent、多模型路由、大规模 Prompt 重构 |
| 成员1 | 合并网页成果、时间轴接真实 API、聊天调试信息和错误状态、浏览器 E2E | 新页面、动画重做、移动端、视觉返工 |

冻结接口：

- `POST /api/v1/chat`：保持现有请求与响应字段不变。
- 新增 `GET /api/v1/life-events?user_id=10001&days=7`。
- 响应固定为 `{ "items": [...], "count": 1 }`；字段沿用 `SQLTool.get_recent_events()` 返回值。
- 前端不直连数据库；事件查询保持 `API -> Service -> Tool -> Database`。

## 四、48 小时时间盒

### 第一天：合并与真实写读闭环

- 10:00 前：成员1把 `9c13e53` 合到最新 `origin/main` 的冲刺分支；三人只基于该分支开发。
- 12:00 前：成员2提供可用 `POSTGRES_DSN`，migration 成功，5 项数据库集成测试不得跳过。
- 14:00 前：成员3交付 `/api/v1/life-events` 和“保存失败不可伪成功”的后端测试。
- 17:00 前：成员1让时间轴读取真实 API，并保留明确的 loading/empty/error 状态。
- 19:00 Gate A：浏览器输入事件后，数据库两张表有记录，时间轴可读回；Gate A 不通过则所有 P1 停止。

### 第二天：反思、计划、演示固化

- 11:00 前：成员2、成员3完成真实 embedding + pgvector 的 reflection/planning 联调。
- 13:00 前：成员1完成聊天调试面板，显示 intent、extracted_events、conversation_id 和请求状态。
- 15:00 功能冻结：只修阻断 Demo 的问题，不再加需求。
- 17:00 Gate B：全新浏览器会话连续完成记录、时间轴读回、复盘、计划四步。
- 19:00 前：提交启动说明、环境示例、测试记录和三位成员 handoff；准备 3 分钟演示脚本。

## 五、统一质量门

后端：

```powershell
cd backend
python -m unittest discover -s tests -p "test_*.py" -v
```

- 79 项既有测试必须保持通过。
- PostgreSQL/pgvector 相关测试必须实际执行，不允许显示 `POSTGRES_DSN is not configured`。
- Redis 测试可在本版继续跳过，但必须在 handoff 中明确说明。

前端：

```powershell
cd frontend
node --test tests/contract.test.mjs
pnpm run build
```

- contract test 通过。
- TypeScript 和 Vite production build 通过。
- 浏览器 Console 无未处理错误。

E2E 证据必须包含：

- 三次真实聊天请求的 HTTP 状态和响应摘要。
- 写入后的 `life_events`、`memories` 查询结果，隐去密钥和完整 DSN。
- 时间轴读回截图或录屏。
- 测试总数、通过数、跳过数、分支和提交号。

## 六、明确延期范围

- Profile 全量后端化、DIY 云端同步、首页任务数据库化。
- Redis 缓存、NotificationAgent、移动端、Kubernetes、正式账号系统。
- 新数据库 Schema、大型 UI 重构、多模型路由和非必要依赖。

## 七、每日同步规则

- 11:30、17:30 两次 10 分钟同步，只汇报：已完成证据、当前阻塞、下一接口交付时间。
- 阻塞超过 30 分钟必须在群内说明；阻塞超过 60 分钟由相邻负责人接手最小修复。
- 每个提交只包含一个可验收行为；禁止再次上传整个目录或提交缓存、`.env`、构建产物。
- Day3 结束分别提交：`成员一/day03_handoff_01.md`、`成员二/day03_handoff_02.md`、`成员三/day03_handoff_03.md`，按“目标、实际完成、系统状态、问题、接口变化、下一步、Git记录”格式记录。
