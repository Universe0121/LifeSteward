export type ChatRequest = {
  user_id: number;
  conversation_id: string;
  user_input: string;
};

export type ChatResponse = {
  assistant_response: string;
  intent: string;
  extracted_events: Array<Record<string, unknown>>;
};

const api_base = import.meta.env.VITE_API_BASE || "/api";

export async function postChat(chat_request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${api_base}/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chat_request),
  });

  if (!response.ok) {
    throw new Error(`chat request failed: ${response.status}`);
  }

  return response.json() as Promise<ChatResponse>;
}
