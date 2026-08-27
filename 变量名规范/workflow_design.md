Workflow Type
	Workflow-1
		事件记录流程
		Trigger:
			用户描述生活事件
		Example:
			"今天学习数学2小时"
		Flow:
			User
			↓
			Master Agent
			↓
			Life Understanding Agent
			↓
			Memory Agent
			↓
			Interaction Agent
			Output:
			保存事件
			返回确认
	Workflow-2
		复盘流程
		Trigger:
			用户询问阶段性成果或问题
		Example:
			"最近为什么效率下降"
		Flow：User
			↓
			Master Agent
			(intent=reflection)
			↓
			Memory Agent
			↓
			Reflection Agent
			↓
			Interaction Agent
	Workflow-3
		计划流程
		Trigger:
			用户要求制定计划
		Example：
			帮我安排下个月的考研计划
		Flow：
			User
			↓
			Master Agent
			↓
			Memory Agent
			↓
			Planning Agent
			↓
			Interaction Agent
	Workflow-4
		异常流程
		Trigger:
			LLM失败
		Flow：
			ERetry 3 times
			↓
			Fallback model
			↓
			Return error
