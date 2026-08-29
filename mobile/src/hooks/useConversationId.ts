import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const storage_key = 'lifeagent_conversation_id';

function create_conversation_id(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useConversationId(): string | null {
  const [conversation_id, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load_conversation_id() {
      try {
        const saved_id = await AsyncStorage.getItem(storage_key);
        const next_id = saved_id?.trim() || create_conversation_id();
        if (!saved_id) await AsyncStorage.setItem(storage_key, next_id);
        if (active) setConversationId(next_id);
      } catch {
        if (active) setConversationId(create_conversation_id());
      }
    }
    void load_conversation_id();
    return () => {
      active = false;
    };
  }, []);

  return conversation_id;
}

export { create_conversation_id };
