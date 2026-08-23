# LifeSteward Day3 开发任务 - 成员1

日期：2026-08-23

## 角色定位

Day3 从“架构与原型负责人”切换为：

> 前端集成 Coding + API Contract 守门人

今天必须产生真实可运行的代码，不再只做静态原型。

---

## 一、最高优先级约束

开发前必须阅读：

- `项目开发参考文件/变量名规范/ai_rules.md`
- `architecture.md`
- `api_spec.md`
- `总体命名规范.md`

必须遵守：

- API 层只负责 HTTP、参数校验、返回响应
- 禁止在前端或 API 中加入 Agent / DB 业务逻辑
- API JSON 字段保持 `snake_case`
- Chat API 使用冻结字段：
  - `user_id`
  - `conversation_id`
  - `user_input`

---

## 二、Day3 总目标

把现有 Mock Demo 改造成真正可运行的 LifeAgent Demo：

```text
Browser
↓
GET /demo
↓
输入用户消息
↓
POST /api/v1/chat
↓
真实 Agent 链路
↓
显示 assistant_response / intent / extracted_events
```

---

## 三、P0：真实聊天前端

### 修改文件

- `backend/static/demo.html`
- `backend/main.py`
- `backend/tests/test_demo_entry.py`

### 必须完成

1. 删除前端对：

```text
/api/v1/mock-chat
```

的依赖。

2. 改为请求：

```text
POST /api/v1/chat
```

3. 请求体固定为：

```json
{
  "user_id": 10001,
  "conversation_id": "demo_xxx",
  "user_input": "今天学习数学2小时"
}
```

4. 页面至少展示：

- `assistant_response`
- `intent`
- `extracted_events`

5. `conversation_id` 在当前页面会话期间保持一致。

---

## 四、P0：Demo 访问入口

在 `backend/main.py` 增加纯展示性质的：

```text
GET /demo
```

用于返回 `backend/static/demo.html`。

禁止：
- 在 `/demo` 中调用 LLM
- 在 `/demo` 中写数据库
- 在 `/demo` 中编排 Agent

---

## 五、P1：前端交互状态

必须实现：

- 发送中 loading
- 发送期间禁止重复提交
- 空输入保护
- 网络异常展示
- API 标准错误展示
- 消息自动滚动到底部

---

## 六、P1：Agent 信息展示

在聊天区域旁边或下方加入开发/演示面板，至少显示：

```text
当前 Intent
当前 conversation_id
本轮 extracted_events
API 请求状态
```

目的：黑客松现场能够直观看到自然语言如何进入 Agent Workflow。

---

## 七、测试要求

新增：

```text
backend/tests/test_demo_entry.py
```

至少验证：

1. `/demo` 可访问
2. 返回 HTML
3. Demo 页面包含 `/api/v1/chat`
4. Demo 页面不再包含 `/api/v1/mock-chat`

同时执行：

```bash
cd backend
python -m unittest discover -s tests -p "test_*.py" -v
```

---

## 八、禁止修改

今天不要主动修改：

- `backend/agents/`
- `backend/services/memory_service.py`
- `backend/tools/`
- 数据库 Schema
- migration
- ReflectionAgent
- PlanningAgent

如果确实发现 API Contract 问题，先记录，不自行改字段。

---

## 九、验收标准

输入：

```text
今天学习数学2小时，很累
```

页面必须完成：

```text
/demo
↓
/api/v1/chat
↓
显示 assistant_response
↓
显示 intent
↓
显示 extracted_events
```

并确保仓库正式 Demo 代码中不再使用：

```text
/api/v1/mock-chat
```

---

## 十、Git

分支：

```text
feature_day3_ui
```

推荐提交：

```text
feat(ui): connect demo to real chat api
feat(ui): add chat status and agent metadata
test(ui): add demo entry tests
```

---

## 十一、交接文件

当天结束必须新增：

```text
成员一/day03_handoff_01.md
```

记录：
- 完成内容
- 修改文件
- 真实 Demo 访问方式
- API 行为
- 未完成问题
- 测试结果
- Branch
- Commit
