backend/

└── schemas/
    ├── user_schema.py
	    创建用户请求
		    from pydantic import BaseModel
			class UserCreateRequest(BaseModel):
			username: str
			 age: int | None = None
		对应API：POST /api/user/register
		请求：{
			"username":"Tom",
			"age":21
			}
		返回：class UserResponse(BaseModel):
			    user_id:int
			    username:str
    ├── chat_schema.py
	    用户发送消息
			from pydantic import BaseModel
			class ChatRequest(BaseModel):
			user_id:int
			conversation_id:str
			user_input:str
		对应API：POST /api/chat
		AI回复：
			class ChatResponse(BaseModel):
			assistant_response:str
			exracted_events:list
			intent:str
		返回具体数据：
			{
			"assistant_response":
			"我发现你最近学习压力较大",
			"intent":
			"reflection",
			"extracted_events":[]
			}
	├── event_schema.py
		对应Life Understanding Agent
		创建生活事件
			class EventCreateRequest(BaseModel):
			    user_id:int
			    event_type:str
			    event_content:str
			    event_time:str
			    emotion:str | None=None
		例如：{
			"user_id":10001,
			"event_type":"exercise",
			event_content":
			"跑步5公里",
			"event_time":
			"2026-08-21 18:00"
			}
		agent输出事件：
			class ExtractedEvent(BaseModel):
			    category:str
			    content:str
			    importance_score:float
			    emotion:str
    ├── memory_schema.py
	    RAG核心
	    查询记忆
		    API：POST /api/memory/search
		    Request：class MemorySearchRequest(BaseModel):
			    user_id:int·
			    memory_query:str
			    top_k:int=5
		返回：
			{
			"memories":[
			{
			"memory_type":"habit",
			"memory_content":
			"用户晚上效率较低",
			"similarity_score":
			0.86
			}
			]
			}
    ├── plan_schema.py
	    创建计划
		    class PlanCreateRequest(BaseModel):
		    user_id:int
		    goal:str
		    deadline:str | None=None
		例如
			{
			"user_id":10001,
			"goal":
			"准备考研数学",
			"deadline":
			"2026-10-01"
			}
		单个任务结构
			class PlanItem(BaseModel):
		    task_name:str
		    start_time:str
		    duration_minutes:int
		    difficulty:float
		返回
			class PlanResponse(BaseModel):
		    generated_plan:list[PlanItem]
    └── reflection_schema.py
		请求：
			class ReflectionRequest(BaseModel):
		    user_id:int
		    analysis_period:int=7
		例如：
			{
			"user_id":10001,
			"analysis_period":7
			}
		返回
			class ReflectionResponse(BaseModel):
		    status:str
		    problem:str
		    suggestion:str
		    score:float

Agent内部Schema
	新增：agents/
		schemas.py
	定义：class AgentEvent(BaseModel):
		    event_type:str
		    event_content:str
		    emotion:str
		    importance_score:float
	Reflection输入：
		class ReflectionContext(BaseModel):
	    recent_events:list[AgentEvent]
	    user_profile:dict
	    retrieved_memories:list
	planning输入：
		class PlanningContext(BaseModel):
	    goal:str
	    reflection_result:dict
	    user_profile:dict
	    memories:list

