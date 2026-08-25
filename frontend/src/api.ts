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

export type LifeEvent = {
  life_event_id: number;
  user_id: string;
  conversation_id: string;
  event_type: string;
  event_content: string;
  event_time: string | null;
  emotion: string;
  importance_score: number;
  source: string;
  source_text: string;
  created_at: string;
};

export type LifeEventsResponse = {
  items: LifeEvent[];
  count: number;
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

export async function getLifeEvents(
  user_id: number | string,
  days = 7,
): Promise<LifeEventsResponse> {
  const search = new URLSearchParams({ user_id: String(user_id), days: String(days) });
  const response = await fetch(`${api_base}/v1/life-events?${search}`);

  if (!response.ok) {
    throw new Error(`life-events request failed: ${response.status}`);
  }

  return response.json() as Promise<LifeEventsResponse>;
}
