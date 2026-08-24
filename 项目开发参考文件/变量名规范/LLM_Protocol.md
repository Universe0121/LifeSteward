接口
	class LLMService:
	    def generate(
	        self,
	        prompt,
	        variables
	    ):
	        pass
	    def embed_text(
	        self,
	        text
	    ):
	        pass

模型配置
.env
LLM_PROVIDER=qwen
MODEL_NAME=qwen-plus
TEMPERATURE=0.7
EMBEDDING_MODEL_NAME=text-embedding-v3

## LLMService.embed_text() 接口边界（Day4）

`embed_text()` 是统一的文本向量化边界，供 `ToolMemoryService` 调用。Agent、API 和 Tool 不得直接初始化或调用具体 embedding SDK。

```python
class LLMService:
    def embed_text(self, text: str) -> list[float]:
        """Return one embedding vector for the supplied text."""
        ...
```

约束：

- 输入必须是非空文本；具体 provider、模型名和维度由环境配置决定。
- 返回值必须是有限浮点数列表；空文本或 provider 失败应抛出统一的 LLM 异常，不得静默生成假向量。
- `ToolMemoryService` 负责调用该接口，并将结果交给 `VectorSearchTool` 持久化或检索；其他层不得绕过该边界。
- Day4 仅约定 `generate(prompt, variables)` 与 `embed_text(text)` 两个模型接口，不新增 rerank、batch、stream 或其他 provider 专用接口。
