import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError, createApiClient } from '../src/api/client';

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

test('posts chat with the frozen snake_case contract', async () => {
  let requested_url = '';
  let requested_init: RequestInit | undefined;
  const api = createApiClient({ api_base_url: 'http://192.168.1.10:8000/', fetch_impl: async (url, init) => { requested_url = String(url); requested_init = init; return response({ assistant_response: '已记录', intent: 'record_event', extracted_events: [] }); } });
  const result = await api.postChat({ user_id: 10001, conversation_id: 'conv_test', user_input: '今天学习数学' });
  assert.equal(result.assistant_response, '已记录');
  assert.equal(requested_url, 'http://192.168.1.10:8000/api/v1/chat');
  assert.equal(requested_init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(requested_init?.body)), { user_id: 10001, conversation_id: 'conv_test', user_input: '今天学习数学' });
});

test('builds life event and weekly report URLs from the configured base', async () => {
  const calls: string[] = [];
  const api = createApiClient({ api_base_url: 'https://lifeagent.example/api', fetch_impl: async (url) => { calls.push(String(url)); return response({ items: [], count: 0 }); } });
  await api.getLifeEvents(10001, 30);
  assert.equal(api.getWeeklyPosterUri(12), 'https://lifeagent.example/api/v1/weekly-reports/12/poster');
  assert.equal(calls[0], 'https://lifeagent.example/api/v1/life-events?user_id=10001&days=30');
});

test('converts non-2xx responses to a safe client error', async () => {
  const api = createApiClient({ api_base_url: 'http://localhost:8000', fetch_impl: async () => response({ success: false, error_code: 'TRANSCRIPTION_UNAVAILABLE', message: '语音服务暂时不可用' }, 503) });
  await assert.rejects(() => api.getLifeEvents(10001), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 503);
    assert.equal(error.error_code, 'TRANSCRIPTION_UNAVAILABLE');
    assert.equal(error.message, '语音服务暂时不可用');
    return true;
  });
});

test('maps a relative poster_url to the backend poster endpoint', () => {
  const api = createApiClient({ api_base_url: 'https://lifeagent.example' });
  assert.equal(api.getWeeklyPosterUri(13), 'https://lifeagent.example/api/v1/weekly-reports/13/poster');
});

test('reports missing API configuration without hardcoding localhost', async () => {
  const api = createApiClient({ api_base_url: '' });
  await assert.rejects(() => api.getLifeEvents(10001), (error: unknown) => error instanceof ApiClientError && error.status === 0 && error.message.includes('EXPO_PUBLIC_API_BASE_URL'));
});
