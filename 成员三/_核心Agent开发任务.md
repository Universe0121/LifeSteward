# LifeAgent Day1 开发任务 - 成员三（核心Agent开发）

## 角色定位

负责第一版Agent核心链路开发。

------------------------------------------------------------------------

# 今日总体目标

完成：

Master Agent

Life Understanding Agent

Interaction Agent

形成最小Agent闭环。

------------------------------------------------------------------------

# 一、今日开发范围

## 1. Master Agent

文件：

agents/master_agent.py

职责：

-   接收AgentState
-   判断intent
-   调度Agent

接口：

process(state: AgentState)

------------------------------------------------------------------------

## 2. Life Understanding Agent

文件：

agents/life_understanding_agent.py

职责：

自然语言

↓

结构化生活事件

输入：

user_input

输出：

extracted_events

示例：

输入：

今天学习数学2小时，很累

输出：

{ "event_type":"study", "event_content":"学习数学2小时",
"emotion":"tired", "importance_score":0.7 }

------------------------------------------------------------------------

## 3. Interaction Agent

文件：

agents/interaction_agent.py

职责：

根据AgentState生成最终回复。

输出：

assistant_response

------------------------------------------------------------------------

# 二、今日不开发范围

暂不实现：

-   Memory Agent
-   PostgreSQL
-   pgvector
-   RAG
-   Reflection Agent
-   Planning Agent

------------------------------------------------------------------------

# 三、代码规则

必须：

-   使用统一AgentState
-   Agent独立class
-   process(state)作为入口

禁止：

-   Agent直接访问数据库
-   Agent直接初始化模型

------------------------------------------------------------------------

# 四、今日验收

完成：

用户输入

↓

Master Agent

↓

Life Understanding Agent

↓

Interaction Agent

↓

返回回复

------------------------------------------------------------------------

# 五、明日交接内容

记录：

-   已完成Agent
-   输入输出字段
-   当前Bug
-   下一步扩展位置
