import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const appSource = await read("src/App.tsx");
for (const label of ["首页", "聊天", "日历", "画像", "定制"]) {
  assert.match(appSource, new RegExp(label));
}
assert.match(appSource, /voice-nav/);
assert.match(appSource, /快捷记录/);

const timelineSource = await read("src/pages/Timeline.tsx");
for (const interaction of ["selected_date", "event_filter", "expanded_id", "getLifeEvents", "loading", "reload_token"]) {
  assert.match(timelineSource, new RegExp(interaction));
}
assert.doesNotMatch(timelineSource, /mocks\/timeline_events/);

const customizeSource = await read("src/pages/Customize.tsx");
for (const interaction of ["localStorage", "addTask", "project_name", "project_description"]) {
  assert.match(customizeSource, new RegExp(interaction));
}

const workspaceSource = await read("src/workspace.tsx");
for (const interaction of ["WorkspaceProvider", "useWorkspace", "toggleTheme", "resetWorkspace"]) {
  assert.match(workspaceSource, new RegExp(interaction));
}

for (const interaction of ["搜索任务", "今日完成率", "连续记录", "快捷记录"]) {
  assert.match(await read("src/pages/Home.tsx"), new RegExp(interaction));
}

for (const interaction of ["新增记录", "上一天", "下一天", "event_form"]) {
  assert.match(timelineSource, new RegExp(interaction));
}

for (const interaction of ["快捷提问", "清空对话", "is_loading"]) {
  assert.match(await read("src/pages/ChatHome.tsx"), new RegExp(interaction));
}

console.log("frontend contract passed");
