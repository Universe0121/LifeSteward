# LifeSteward Day3 开发任务 - 成员1（加速支援）

日期：2026-08-25 至 2026-08-26  
角色：Frontend Integration / Demo Operator

## 一、任务目标

把已提交的网页增强 `9c13e53` 合入最新后端基线，并将聊天和时间轴接到真实 API。只做演示闭环必需的前端工作，不再进行视觉重构。

## 二、P0-1：上午完成安全合并

1. 从最新 `origin/main@5b26a77` 创建冲刺分支。
2. 合入或 cherry-pick `9c13e53`。
3. 确认合并后同时存在 Production Wiring 和前端 `WorkspaceProvider`。
4. 运行 contract test 与 production build。

不得把远端后端提交覆盖为本地旧版本。

## 三、P0-2：聊天页只显示真实结果

修改 `frontend/src/api.ts` 与 `frontend/src/pages/ChatHome.tsx`：

- `conversation_id` 在当前浏览器会话中稳定，不要每次刷新固定复用全局 `conv_001`。
- 展示 `intent`、`extracted_events`、`conversation_id`、请求状态。
- 网络或后端失败时显示明确错误和重试按钮。
- 正式演示模式禁止把失败替换成“我先帮你记下了”的 mock 成功文案。
- 保持 loading、禁重复提交、空输入保护。

## 四、P0-3：时间轴接真实数据库

成员3冻结接口后，新增：

```typescript
getLifeEvents(user_id: number, days: number): Promise<LifeEventListResponse>
```

时间轴要求：

- 首次进入调用 `GET /api/v1/life-events?user_id=10001&days=7`。
- 显示 loading、empty、error 和 retry。
- 聊天成功记录后切换到时间轴即可看到真实事件。
- API 可用时不得混入本地 JSON 伪装真实数据。
- 本地 mock 仅允许通过显式开发开关启用，并在页面标明“演示数据”。
- “新增记录”按钮本次可以改为跳转聊天页并预填记录提示，不另造直写数据库接口。

## 五、P0-4：浏览器 E2E 与演示脚本

按顺序跑通并记录：

1. 打开聊天页，输入“今天学习数学2小时，有点累”。
2. 确认 UI 显示真实成功响应和 `record_event`。
3. 打开时间轴，确认出现同一事件。
4. 回到聊天，依次请求复盘和明日计划。
5. 停止后端或使用无效地址，确认 UI 显示错误而不是 mock 成功。

交付一份不超过 3 分钟的演示词和启动顺序，现场只需启动数据库、后端、前端三项。

## 六、禁止事项

- 不重做配色、动画、布局和新页面。
- 不把 Profile、DIY、首页任务改成云端数据。
- 不修改 Agent、Tool、migration。
- 不在前端保存 DSN、模型 Key 或完整内部错误栈。

## 七、完成标准与交接

- 合并分支无冲突且包含前后端两条成果线。
- contract test 与 Vite production build 通过。
- 浏览器四步 E2E 通过，Console 无未处理错误。
- 后端失败时无虚假成功提示。
- 时间轴数据来源可明确区分“真实 API”与“演示数据”。

更新 `成员一/day03_handoff_01.md`，记录真实 Demo 地址、API、测试、浏览器验收、未完成项、分支和提交。

推荐提交：

```text
chore(ui): integrate frontend with latest backend baseline
feat(ui): load persisted events in timeline
fix(ui): show real chat failures without mock success
test(ui): cover demo integration contract
```
