# LifeAgent 周报总结 Agent 与图鉴式海报任务 - 成员三

## 角色定位

负责每周生活数据汇总、周报 Agent、结构化周报持久化、图鉴式海报生成，以及供网页和 Expo 移动端读取的 API。

本任务不负责语音输入，也不负责移动端页面实现。

## 总体目标

每周一 00:05（Asia/Shanghai）为有数据的用户生成上一自然周周报。周报可在客户端查看，并可通过海报 URL 分享。

本次周报改版以你发来的参考图为准，整体从“摘要型周报”升级为“数据概览 + 生活叙事”的组合结构。

## 周报内容框架

### 1. 周概览

- 周标题
- 本周主题
- 一句话总述
- 周起止日期

### 2. 时间结构分析

- 各类活动占比
- 与上周对比的增减趋势
- 睡眠、工作、娱乐、创作、学习、社交、运动、家务等分类

### 3. 重点生活模块回顾

- 健康与自律
- 工作与学习
- 创作与分享
- 社交与娱乐
- 生活记录

每个模块应包含：

- 模块标题
- 一段简短回顾
- 2 到 4 条要点
- 可选的事件依据

### 4. 本周高光事件

- 3 到 5 条
- 偏“周记叙事”，不是纯统计
- 允许按事件类型、情绪或主题聚类

### 5. 完成度与下周建议

- 本周完成了什么
- 哪些目标还差一点
- 下周建议保持什么、补什么

## 已冻结的 API 契约

### 生成周报

`POST /api/v1/weekly-reports/generate`

请求：

```json
{
  "user_id": 10001,
  "week_start": "2026-08-17",
  "timezone": "Asia/Shanghai"
}
```

`week_start` 为空时默认计算最近一个已结束的周一；同一 `user_id + week_start` 重复调用必须幂等。

响应至少包含：

```json
{
  "report_id": 12,
  "user_id": "10001",
  "week_start": "2026-08-17",
  "week_end": "2026-08-23",
  "report_data": {
    "overview": {},
    "activity_analysis": {},
    "section_reviews": [],
    "highlights": [],
    "completion": {},
    "next_week_suggestions": []
  },
  "poster_url": "/api/v1/weekly-reports/12/poster",
  "generated_at": "2026-08-24T00:05:00+08:00"
}
```

> 说明：如现有前端仍依赖旧字段，可保留 `summary`、`highlights`、`stats`、`suggestions` 作为兼容别名，但新版文档以 `report_data` 为主结构。

### 查询历史周报

`GET /api/v1/weekly-reports?user_id=10001&limit=10`

按 `week_start DESC` 返回周报列表。

### 获取海报

`GET /api/v1/weekly-reports/{report_id}/poster`

返回可直接浏览和分享的 `image/svg+xml`。SVG 必须内嵌文字和样式，不依赖本地字体或前端运行时。

## 开发范围

### 1. 数据库与 Service

建议文件：

- 创建：`backend/migrations/002_weekly_reports.sql`
- 修改：`backend/database_schema.md`
- 创建：`backend/services/weekly_report_service.py`
- 修改：`backend/tools/sql_tool.py`，只增加周报读写方法，不改变已有方法签名

`weekly_reports` 至少包含：`report_id`、`user_id`、`week_start`、`week_end`、`report_data JSONB`、`poster_svg TEXT`、`generated_at`，并建立 `UNIQUE(user_id, week_start)`。

所有生活事件必须通过 `SQLTool.get_events_in_range()` 获取，Agent 不得直接访问数据库。

### 2. WeeklyReportAgent

建议文件：

- 创建：`backend/agents/weekly_report_agent.py`
- 创建：`backend/prompts/weekly_report_prompt.md`
- 修改：`backend/core/composition_root.py`

输入：用户 ID、周起止日期、该周期事件列表、用户画像（可为空）。

输出字段建议固定为：

- `overview: dict`
- `activity_analysis: dict`
- `section_reviews: list[dict]`
- `highlights: list[dict]`
- `completion: dict`
- `next_week_suggestions: list[str]`

要求：

- LLM 返回非法 JSON、空数据或超时均有确定性的降级结果。
- 不得编造事件、时间、地点、数值或用户未提供的情绪。
- 统计值由代码计算，不能由 LLM 自由填写。
- `highlights` 最多 5 条，`next_week_suggestions` 最多 3 条。
- 模块文案应适配“左侧时间结构、右侧叙事模块”的海报版式。

### 3. 图鉴式海报

建议文件：

- 创建：`backend/services/weekly_poster.py`

使用确定性的 SVG 模板生成海报，至少包含：

- 周标题
- 总述
- 时间结构分析
- 重点生活模块回顾
- 高光事件
- 完成度与下周建议
- LifeAgent 标识

版式建议：

- 画布比例固定为 1:1，建议 1080×1080 viewBox
- 左侧突出活动占比和分类分布
- 右侧突出模块回顾和叙事内容
- 底部放周主题、完成度或品牌信息

要求：

- 所有用户内容必须进行 XML 转义
- 无事件时生成“本周还没有记录”的空状态海报
- 生成结果直接存入 `weekly_reports.poster_svg`，避免每次访问重新调用 LLM

### 4. 定时入口

建议文件：

- 创建：`backend/scripts/generate_weekly_reports.py`

脚本职责：

- 计算上一自然周
- 查询有事件的用户 ID
- 对每个用户调用 `WeeklyReportService.generate_for_week()`
- 单个用户失败不阻塞其他用户，并输出可审计日志

部署约定：由 Windows Task Scheduler、Linux cron 或 CI 定时在每周一 00:05（Asia/Shanghai）执行；不要在 FastAPI 请求进程内启动无限循环调度器。

## 不在本任务范围

- 不使用生成式图片服务；本期海报采用 SVG 模板
- 不新增推送通知渠道
- 不修改 `ChatRequest`、`AgentState` 的既有字段
- 不实现移动端页面，只保证 API 和海报 URL 可被移动端消费

## 测试与验收

至少覆盖：

- 周一到周日的时间边界和 Asia/Shanghai 时区
- 重复生成的幂等性
- 无事件、单事件、多类型事件的统计结果
- 非法 JSON、LLM 异常和无画像时的降级结果
- 海报中的 XML 转义和固定 1:1 尺寸
- 时间结构分析、模块回顾和高光事件的字段结构
- 生成接口、列表接口、海报接口的响应契约
- 现有后端测试全部通过

## 交接给成员二

1. API Schema、示例响应和字段类型
2. `poster_url` 的完整拼接规则及 SVG MIME 类型
3. 移动端展示所需的空状态和错误状态
4. 定时脚本执行命令与所需环境变量
5. 数据库迁移编号、测试结果和真实 LLM/数据库联调缺口

## 协作约束

- 以最新 `main` 为基线开发，不整目录覆盖成员二的数据库或 Tool 实现
- 若需修改 `backend/core/settings.py`，必须先与成员一确认并只提交增量
- 提交拆成“迁移与 Tool”“Agent 与 Prompt”“海报与 API”“定时脚本与测试”四组
