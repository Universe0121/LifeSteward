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

async function requestError(response: Response, request_name: string): Promise<Error> {
  let message = `${request_name} request failed`;
  try {
    const payload = await response.json() as { message?: unknown };
    if (typeof payload.message === "string" && payload.message.trim()) {
      message = payload.message.trim();
    }
  } catch {
    // The status still gives the user an actionable error when the body is not JSON.
  }
  return new Error(`${message} (${response.status})`);
}

export async function postChat(chat_request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${api_base}/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chat_request),
  });

  if (!response.ok) {
    throw await requestError(response, "chat");
  }

  return response.json() as Promise<ChatResponse>;
}

export async function getLifeEvents(
  user_id: number | string,
  days = 7,
  range?: { start_date: string; end_date: string },
): Promise<LifeEventsResponse> {
  const search = new URLSearchParams({ user_id: String(user_id) });
  if (range) {
    search.set("start_date", range.start_date);
    search.set("end_date", range.end_date);
  } else {
    search.set("days", String(days));
  }
  const response = await fetch(`${api_base}/v1/life-events?${search}`);

  if (!response.ok) {
    throw await requestError(response, "life-events");
  }

  return response.json() as Promise<LifeEventsResponse>;
}
