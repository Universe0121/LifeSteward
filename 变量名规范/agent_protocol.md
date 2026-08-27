AgentState最终版本
class AgentState(TypedDict):
    user_id:str
    conversation_id:str
    user_input:str
    intent:str
    extracted_events:list
    retrieved_memories:list
    user_profile:dict
    current_goal:dict
    generated_plan:list
    reflection_result:dict
    assistant_response:

每个agent输入：AgentState
输出：AgentState