                 Client
                   |
               FastAPI
                   |
             Master Agent
                   |
             Agent Router
                   |
---------------------------------
 Life       Memory      Reflection

 Agent      Agent       Agent
 ---------------------------------
                   |
                Services
                   |
                Tools
                   |
 ---------------------------------

 Redis PostgreSQL pgvector

2.分层职责
 API Layer
	负责：
	- HTTP请求
	- 参数校验
	- 返回响应
	禁止：
	- 调用LLM
	- 数据库操作
	- Agent逻辑

 Master Agent
	负责：
	- 任务理解
	- Agent调度
	- Workflow控制
	不负责：
	- 具体业务

Specialized Agent
	例如：
	Life Understanding Agent：
	负责：
	user_input
	↓
	extracted_events
	不负责：
	- 保存数据库

Service Layer
	负责：
	业务组合。
	例如：
	Memory Service：
		save_memory()
		search_memory()
		compress_memory()

Tool Layer
	负责：
	能力封装。
	例如：
	VectorSearchTool
	SQLTool
	NotificationTool

 Database Layer
	负责：
	持久化。