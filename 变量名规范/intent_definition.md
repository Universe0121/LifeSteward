定义Intent枚举
class Intent(Enum):
    RECORD_EVENT="record_event"
    QUERY_MEMORY="query_memory"
    REFLECTION="reflection"
    PLANNING="planning"
    UPDATE_PROFILE="update_profile"
    CASUAL_CHAT="casual_chat"

| Intent         | Agent              |
| -------------- | ------------------ |
| record_event   | life understanding |
| query_memory   | memory             |
| reflection     | memory+reflection  |
| planning       | memory+planning    |
| update_profile | memory             |
| casual_chat    | interaction        |
Intent判断规则
例如：
输入：我今天很累
	分类
		{
		intent:"record_event"
		}
输入：最近为什么睡不好
	分类：
		{
		intent:"reflection"
		}