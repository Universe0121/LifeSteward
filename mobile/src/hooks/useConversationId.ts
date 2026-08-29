import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from 'react';
const key = 'lifeagent_conversation_id';
export function useConversationId() {
  const [conversation_id, setConversationId] = useState('');
  useEffect(() => { const uri = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${key}.txt` : null; if (!uri) { setConversationId(`conv_${Date.now()}`); return; } FileSystem.readAsStringAsync(uri).catch(() => '').then((saved) => { const value = saved || `conv_${Date.now()}`; setConversationId(value); if (!saved) void FileSystem.writeAsStringAsync(uri, value); }); }, []);
  return conversation_id;
}
