import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const frontendRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function read(relativePath) {
  return readFile(resolve(frontendRoot, relativePath), "utf8");
}

const packageJson = JSON.parse(await read("package.json"));
assert.equal(packageJson.scripts.build, "tsc && vite build");
assert.equal(packageJson.type, "module");

for (const page of ["Home", "ChatHome", "Timeline", "Profile", "Customize"]) {
  await read(`src/pages/${page}.tsx`);
}

const apiSource = await read("src/api.ts");
for (const field of ["user_id", "conversation_id", "user_input", "assistant_response", "extracted_events"]) {
  assert.match(apiSource, new RegExp(field));
}
for (const contract of ["getLifeEvents", "/v1/life-events", "LifeEventsResponse", "created_at"]) {
  assert.match(apiSource, new RegExp(contract));
}

const vite = await createServer({ root: frontendRoot, server: { middlewareMode: true }, appType: "custom" });
try {
  const api = await vite.ssrLoadModule("/src/api.ts");
  const originalFetch = globalThis.fetch;
  let capturedRequest;
  globalThis.fetch = async (input, init) => {
    capturedRequest = { input: String(input), init };
    return new Response(JSON.stringify({
      success: false,
      error_code: "AGENT_PROCESSING_ERROR",
      message: "数据库暂时不可用",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  };
  await assert.rejects(
    () => api.postChat({ user_id: 10001, conversation_id: "conv-test", user_input: "测试" }),
    /数据库暂时不可用.*500/,
  );
  assert.equal(capturedRequest.input, "/api/v1/chat");
  assert.equal(capturedRequest.init.method, "POST");
  assert.deepEqual(capturedRequest.init.headers, { "Content-Type": "application/json" });
  assert.deepEqual(JSON.parse(capturedRequest.init.body), {
    user_id: 10001,
    conversation_id: "conv-test",
    user_input: "测试",
  });
  globalThis.fetch = originalFetch;

  const chatModule = await vite.ssrLoadModule("/src/pages/ChatHome.tsx");
  assert.equal(typeof chatModule.getConversationId, "function");
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const firstId = chatModule.getConversationId(storage, () => "first-id");
  const secondId = chatModule.getConversationId(storage, () => "second-id");
  assert.equal(firstId, "conv_first-id");
  assert.equal(secondId, firstId);
  assert.doesNotThrow(() => chatModule.getConversationId({
    getItem: () => { throw new Error("storage disabled"); },
    setItem: () => { throw new Error("storage disabled"); },
  }, () => "fallback-id"));
  const emptyStorage = {
    getItem: () => null,
    setItem: () => undefined,
  };
  assert.doesNotThrow(() => chatModule.getConversationId(emptyStorage, () => { throw new Error("uuid disabled"); }));

  const clearedDetails = chatModule.emptyRequestDetails("idle");
  assert.deepEqual(clearedDetails, {
    status: "idle",
    intent: "-",
    extracted_events: [],
    error: "",
    retry_content: "",
  });

  globalThis.fetch = async (input, init) => {
    capturedRequest = { input: String(input), init };
    return new Response(JSON.stringify({ count: 0, items: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  assert.deepEqual(await api.getLifeEvents(10001, 7), { count: 0, items: [] });
  assert.equal(capturedRequest.input, "/api/v1/life-events?user_id=10001&days=7");
  assert.equal(capturedRequest.init, undefined);
  globalThis.fetch = originalFetch;
} finally {
  await vite.close();
}

const appSource = await read("src/App.tsx");
for (const label of ["首页", "聊天", "日历", "画像", "定制"]) {
  assert.match(appSource, new RegExp(label));
}

const timelineSource = await read("src/pages/Timeline.tsx");
for (const interaction of ["selected_date", "event_filter", "expanded_id", "getLifeEvents", "loading", "reload_token"]) {
  assert.match(timelineSource, new RegExp(interaction));
}
assert.doesNotMatch(timelineSource, /mocks\/timeline_events/);
for (const fakeLocalEvent of ["frontend_demo", "frontend_quick_record", "addEvent", "event_form"]) {
  assert.doesNotMatch(timelineSource, new RegExp(fakeLocalEvent));
}

const customizeSource = await read("src/pages/Customize.tsx");
for (const interaction of ["localStorage", "addTask", "project_name", "project_description"]) {
  assert.match(customizeSource, new RegExp(interaction));
}

const workspaceSource = await read("src/workspace.tsx");
for (const interaction of ["WorkspaceProvider", "useWorkspace", "toggleTheme", "resetWorkspace"]) {
  assert.match(workspaceSource, new RegExp(interaction));
}

for (const interaction of ["上一天", "下一天", "重新加载"]) {
  assert.match(timelineSource, new RegExp(interaction));
}

const chatSource = await read("src/pages/ChatHome.tsx");
for (const interaction of ["快捷提问", "清空对话", "is_loading", "sessionStorage", "请求状态", "会话 ID", "意图", "提取事件", "重试"]) {
  assert.match(chatSource, new RegExp(interaction));
}
for (const fakeSuccess of ["我先帮你记下了", "演示模式：已使用 mock 回复"]) {
  assert.doesNotMatch(chatSource, new RegExp(fakeSuccess));
}

console.log("frontend contract passed");
