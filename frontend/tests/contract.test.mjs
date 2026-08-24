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

const appSource = await read("src/App.tsx");
for (const label of ["首页", "聊天", "日历", "画像", "定制"]) {
  assert.match(appSource, new RegExp(label));
}

const timelineSource = await read("src/pages/Timeline.tsx");
for (const interaction of ["selected_date", "event_filter", "expanded_id", "timeline_events"]) {
  assert.match(timelineSource, new RegExp(interaction));
}

const customizeSource = await read("src/pages/Customize.tsx");
for (const interaction of ["localStorage", "addTask", "project_name", "project_description"]) {
  assert.match(customizeSource, new RegExp(interaction));
}

console.log("frontend contract passed");
