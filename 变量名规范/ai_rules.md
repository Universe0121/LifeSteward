├── 1. 项目定位规则
	## Project Identity
	你正在参与 LifeAgent 项目开发。
	项目类型：
	Multi-Agent Personal Life Assistant
	核心架构：
	User
	 ↓
	API
	 ↓
	Master Agent
	 ↓
	Specialized Agents
	 ↓
	Services
	 ↓
	Database
	禁止：
	- 单体Agent实现所有功能
	- 绕过Agent直接调用LLM
	- 将业务逻辑写入API层
├── 2. 架构约束规则
	## Architecture Rules
	必须遵守:
	API层
	    ↓
	Service层
	    ↓
	Agent层
	    ↓
	Tool层
	    ↓
	Database
	禁止：
	Agent → Database
	API → Database
	API → LLM
├── 3. Agent开发规则
	## Agent Rules
	每个Agent必须：
	1. 单独文件
	2. 独立class
	3. 使用统一AgentState
	4. 不保存内部状态
	格式：
	class XxxAgent:
	    def process(
	        self,
	        state:AgentState
	    ):
	        pass
├── 4. agent state规则
	所有Agent之间传递信息必须通过 AgentState。
	禁止：
	Agent之间：
	直接传递对象
	直接调用内部变量
	例如禁止：
	reflection_agent.memory = memory_agent.result
	正确：
	state["retrieved_memories"]
├── 5. 数据流规则
	## Data Flow
	用户输入：
	user_input
	↓
	Life Understanding Agent
	↓
	extracted_events
	↓
	Memory Agent
	↓
	retrieved_memories
	↓
	Reflection Agent
	↓
	reflection_result
	↓
	Planning Agent
	↓
	generated_plan
	↓
	assistant_response
├── 6.数据库开发规则
	Database Rules
	禁止：
	任何AI直接修改数据库结构。
	新增字段必须：
		1. 更新 database_schema.md
		2. 创建 migration 文件
		3. 所有人同步数据库
├── 7. Prompt管理规则
	增加
	prompts/
		├── life_understanding_prompt.md
		├── reflection_prompt.md
		├── planning_prompt.md
	规则
		禁止：
		在Python代码中硬编码Prompt。
		错误：
		llm.invoke(
		"你是一个生活助手..."
		)
		正确：
		PromptTemplate加载文件。
├── 8. Service开发规则
	Service Responsibility
	Service负责：
	- 业务逻辑
	- 数据组合
	- 调用工具
	Service不负责：
	- 用户输入解析
	- LLM Prompt
	- API格式转换
├── 9. RAG规则
	## RAG Rules
	Embedding流程：
	文本
	↓
	chunk
	↓
	embedding
	↓
	pgvector
	查询：
	memory_query
	↓
	query_embedding
	↓
	similarity search
	↓
	retrieved_memories
├── 10. 模型调用规则
	## LLM Rules
	所有模型调用必须经过：
	core/llm_service.py
	禁止：
	Agent内部：
	OpenAI()
	ChatOpenAI()
	直接初始化
├── 11. 错误处理规则
	## Error Handling
	所有Service必须：
	try:
	except:
	返回统一错误格式。
	{
	"success":false,
	"error_code":"",
	"message":""
	}
├── 12. 测试规则
	## Testing Rules
	新增功能必须：
	至少提供：
	1 unit test
	测试位置：
	tests/
	命名：
	test_xxx.py
├── 13. Git协作规则
	## Git Rules
	Branch:
	feature_xxx
	Commit:
	feat:
	fix:
	docs:
	refactor:
	例如：
	feat(memory): add vector retrieval
├── 14. AI生成代码流
	## AI Development Workflow
	当要求AI开发功能时：
	Step1:
	阅读：
	- architecture.md
	- naming_rules.md
	- agent_protocol.md
	Step2:
	确认：
	- 输入变量
	- 输出变量
	- 文件位置
	Step3:
	生成代码
	Step4:
	检查：
	是否违反：
	- 分层架构
	- 命名规范
	- AgentState
	Step5:
	生成测试代码
├── 15. 依赖管理规则
	## Dependency Rules
	禁止：
	AI自行增加Python依赖。
	新增依赖必须：
	1. 修改 requirements.txt
	2. 说明用途
	3. 测试docker环境
├── 16. 文件修改规则
	## File Modification Rules
	AI修改代码前必须：
	说明：
		1. 修改文件
		2. 修改原因
		3. 影响范围
	禁止：
	一次生成大量未确认文件。
