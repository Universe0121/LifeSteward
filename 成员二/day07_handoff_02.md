# LifeAgent 每日开发进度记录

日期：2026-08-29

负责人：李浩天

------------------------------------------------------------------------

# 一、今日目标

- 从最新 `origin/main` 创建独立分支，完成 React + TypeScript + Vite 网页 Demo 到 React Native + Expo 移动端的迁移基础。
- 通过 HTTP API 接入聊天、时间轴、语音转写、周报列表和 SVG 海报分享，不在移动端访问数据库、pgvector、LLM 或 Agent。
- 建立 mock 模式和错误恢复路径，使没有真实后端时仍可验证移动端页面流程。
- 按 `每日开发进度记录模板.md` 交接 Expo 运行、接口契约和真实设备验收状态。

------------------------------------------------------------------------

# 二、实际完成内容

## 完成模块

- 已从最新 `origin/main@05b5daa` 创建 `codex/feature_day7_expo_mobile_migration`。
- 已创建 Expo SDK 52 TypeScript 移动端工程，包含底部 Tab：首页、聊天、时间轴、画像；首页可进入周报详情 Stack 页面。
- 已实现类型安全 API 客户端，支持 `POST /api/v1/chat`、`GET /api/v1/life-events`、`POST /api/v1/speech-to-text`、`GET /api/v1/weekly-reports` 和周报海报 URL。
- 已实现 `EXPO_PUBLIC_API_MODE=mock` 本地 mock 适配，支持在未启动后端时检查页面和交互。
- 已实现会话 ID 的 AsyncStorage 持久化，聊天发送中/成功/失败/重试和语音转写回填输入框。
- 已实现 Expo 官方 `expo-av` 录音、Android/iOS 麦克风权限处理、multipart 上传和录音资源释放。
- 已实现时间轴 7/30 天范围、事件类型筛选、加载、空状态、网络错误和重试。
- 已实现画像字段展示；由于当前后端没有独立画像查询 API，页面使用既有字段并保留后续接入位置。
- 已实现周报摘要、亮点、统计、建议、空状态和海报分享失败恢复；真实 SVG 海报使用 `expo-file-system` 写入临时目录后由 `expo-sharing` 分享。
- 已添加移动端 `.env.example`、README、Expo doctor 配置和根 `.gitignore` 排除项。

## 修改文件

文件路径：`mobile/`

修改内容：新增 Expo 工程、导航、主题、API 类型/真实客户端/mock 客户端、四个核心页面、周报详情、语音输入组件与 hooks、测试和启动说明。

影响范围：新增移动端工程；不修改后端 Agent、Prompt、数据库、成员一或成员三的运行时代码。

文件路径：`.gitignore`

修改内容：排除移动端依赖、Expo 缓存、构建产物、录音文件和签名文件。

影响范围：Git 提交范围和本地构建文件，不影响运行时。

文件路径：`成员二/day07_handoff_02.md`

修改内容：记录移动端实现、接口契约、测试、设备状态和队友依赖。

影响范围：成员二向成员一、成员三和项目负责人的交接信息。

------------------------------------------------------------------------

# 三、当前系统状态

## 已完成链路

文字输入：

`ChatScreen`

↓

`api_client.postChat()`

↓

`POST /api/v1/chat`

↓

后端现有 Chat / Agent / Tool / Database 链路

时间轴：

`TimelineScreen`

↓

`api_client.getLifeEvents()`

↓

`GET /api/v1/life-events?user_id=10001&days=7|30`

周报：

`HomeScreen`

↓

`GET /api/v1/weekly-reports?user_id=10001&limit=3`

↓

`WeeklyReportScreen`

↓

`GET /api/v1/weekly-reports/{report_id}/poster`

↓

`image/svg+xml` 临时文件

↓

`expo-sharing`

语音：

`VoiceInputButton`

↓

Expo `Audio.Recording`

↓

multipart `POST /api/v1/speech-to-text`

↓

转写文本回填聊天输入框，用户确认后再调用 `POST /api/v1/chat`

## 已完成验证

- Expo doctor：18/18 checks passed。
- `npm run typecheck`：通过。
- `npm test`：5 tests passed，0 failed。
- `npx expo export --platform web`：成功，Metro Web Bundled 638 modules。
- Expo Web 浏览器检查：mock 首页、聊天发送、时间轴、画像、周报详情均可渲染；mock 聊天返回成功消息；无运行时 error。
- Node：v22.14.0 便携运行时；npm：10.9.2；Expo SDK：52.0.0。

## 未完成模块

- 当前 `origin/main@05b5daa` 尚未包含成员一的 `POST /api/v1/speech-to-text` 路由，真实语音上传/转写尚未完成；客户端已按冻结契约接入并对 404/503 做友好错误恢复。
- 当前本机没有 Android SDK、ADB、模拟器或 Java，未完成 Android/iOS 实体设备的麦克风授权、录音、转写真机验收。
- 当前后端没有独立用户画像查询 API，画像页暂展示既有字段；不在本次成员二范围内新增后端接口。
- 真实 PostgreSQL、LLM、语音服务数据联调未在移动端执行；移动端只依赖后端 HTTP 接口。

------------------------------------------------------------------------

# 四、遇到的问题

问题：系统没有 Node/Expo 工具。

原因：执行环境 PATH 中没有 Node.js、npm、Expo。

解决方案：使用 Node.js v22.14.0 便携运行时安装 Expo SDK 52 依赖；依赖目录被 `.gitignore` 排除。

问题：Expo Web 首次导出提示缺少 `@expo/metro-runtime` 和 `expo-asset`。

原因：手动创建工程时没有自动生成 Expo Web 的全部 peer/runtime 依赖。

解决方案：按 Expo SDK 52 兼容版本补齐依赖，随后 Web 导出成功。

问题：Expo doctor 提示 `expo-av` 在 React Native Directory 中已不再维护。

原因：SDK 52 的官方录音实现仍是 `expo-av`，而 `expo-audio` 需要后续 SDK 升级窗口。

解决方案：保留 SDK 52 可用的官方 `expo-av`，在 `package.json` 中仅排除该项 doctor 维护性提示；升级 Expo SDK 时应迁移到 `expo-audio` 并重新验证录音链路。

问题：队友提供了 StepFun 语音配置。

原因：真实语音配置属于后端服务凭据，不应进入 Expo 客户端或 GitHub。

解决方案：已将 `SPEECH_TO_TEXT_BASE_URL`、`SPEECH_TO_TEXT_API_KEY`、`SPEECH_TO_TEXT_MODEL`、`SPEECH_TO_TEXT_TIMEOUT` 写入本地 `backend/.env`；该文件被 Git 忽略，handoff 不暴露真实 key。当前 main 尚无对应后端路由，配置暂待成员一代码合入后启用。

------------------------------------------------------------------------

# 五、接口变化记录

新增：

- 移动端内部 `ApiClient` 类型和 `ApiClientError` 统一错误类型。
- 移动端 mock API 模式：`EXPO_PUBLIC_API_MODE=mock`。
- 移动端环境变量：`EXPO_PUBLIC_API_BASE_URL`、`EXPO_PUBLIC_API_MODE`。

修改：

- 无后端 API、数据库、Agent、Prompt 或现有网页端接口修改。
- `EXPO_PUBLIC_API_BASE_URL` 期望填写后端 origin，例如 `http://192.168.1.10:8000`；客户端自动拼接 `/api/v1`。

删除：

- 无。

成员一联调依赖：

- 语音接口：`POST /api/v1/speech-to-text`。
- multipart 字段：`audio`、`user_id`、`language`。
- 移动端上传 Android 优先使用 `.m4a` / `audio/m4a`，浏览器 mock 不执行真实录音。
- 后端变量名：`SPEECH_TO_TEXT_BASE_URL`、`SPEECH_TO_TEXT_API_KEY`、`SPEECH_TO_TEXT_MODEL`、`SPEECH_TO_TEXT_TIMEOUT`。

成员三联调依赖：

- `GET /api/v1/weekly-reports?user_id=10001&limit=10`。
- `GET /api/v1/weekly-reports/{report_id}/poster`，成功 MIME 为 `image/svg+xml`。
- `poster_url` 为相对路径，移动端按 `EXPO_PUBLIC_API_BASE_URL + poster_url` 解析。
- 无周报响应为 `{ "items": [], "count": 0 }`；海报失败不会阻塞其他 Tab。

------------------------------------------------------------------------

# 六、明日开发建议

下一步：

- 成员一合入语音接口后，在同一局域网后端上用 Expo Go 完成麦克风授权、录音、转写和确认发送。
- 使用真实 `EXPO_PUBLIC_API_BASE_URL` 做 Android/iOS 请求验证，确认后端 CORS/局域网访问策略。
- 成员三确认周报 API 的真实数据后，验证 SVG 海报在实体设备上的预览和分享。
- Expo SDK 升级时迁移 `expo-av` 到 `expo-audio`，删除 doctor 排除项并重新做真机回归。

优先级：P0 语音后端路由合入与真机验证；P1 周报真实数据和 SVG 分享验证；P2 Expo SDK 音频模块升级。

负责人：李浩天负责移动端；成员一负责语音服务；成员三负责周报 API 和海报数据。

------------------------------------------------------------------------

# 七、Git记录

Branch：`codex/feature_day7_expo_mobile_migration`

Commit：`597519006670736030597d17f1511bad5a9a7713`（移动端源码、配置和测试）。

远端：`origin/codex/feature_day7_expo_mobile_migration`

测试记录：

```powershell
cd D:\Codex\黑客松\mobile
npm run typecheck
npm test
npx expo-doctor
npx expo export --platform web
$env:EXPO_PUBLIC_API_MODE = "mock"
npx expo start --web --port 8081
```

结果：类型检查通过；API 客户端测试 5/5 通过；Expo doctor 18/18 通过；Web 导出成功；浏览器 mock 页面流程通过。

安全说明：未提交 `backend/.env`、`mobile/.env`、真实语音 key、录音文件、Expo 构建产物、依赖缓存或 `LifeSteward-main` 下载目录。
