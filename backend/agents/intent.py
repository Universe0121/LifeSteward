"""Intent values supported by the Master Agent router."""

from enum import Enum


class Intent(str, Enum):
    RECORD_EVENT = "record_event"
    QUERY_MEMORY = "query_memory"
    REFLECTION = "reflection"
    PLANNING = "planning"
    UPDATE_PROFILE = "update_profile"
    CASUAL_CHAT = "casual_chat"

    @classmethod
    def contains(cls, value: str) -> bool:
        return value in cls._value2member_map_
