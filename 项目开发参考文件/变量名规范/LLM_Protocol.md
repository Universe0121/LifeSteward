接口
	class LLMService:
	    def generate(
	        self,
	        prompt,
	        variables
	    ):
	        pass

模型配置
.env
LLM_PROVIDER=qwen
MODEL_NAME=qwen-plus
TEMPERATURE=0.7
