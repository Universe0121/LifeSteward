import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const conversation_storage_key = 'lifeagent.conversation_id';

function create_conversation_id(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useConversationId(): string | null {
  const [conversation_id, setConversationId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(conversation_storage_key).then((stored) => {
      if (!active) return;
      const next_conversation_id = stored ?? create_conversation_id();
      setConversationId(next_conversation_id);
      if (!stored) void AsyncStorage.setItem(conversation_storage_key, next_conversation_id);
    }).catch(() => { if (active) setConversationId(create_conversation_id()); });
    return () => { active = false; };
  }, []);
  return conversation_id;
}
