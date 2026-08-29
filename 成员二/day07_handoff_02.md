# LifeAgent 每日开发进度记录

日期：2026-08-29

负责人：李浩天

------------------------------------------------------------------------

# 一、今日目标

完成 GitHub 网页端到 React Native + Expo 移动端的迁移，保持原有中文文案、颜色、卡片结构、五项底部导航和核心交互；接入现有后端 HTTP API，补齐语音输入适配，并生成可独立启动的 Android 安装包。

------------------------------------------------------------------------

# 二、实际完成内容

## 完成模块

-   使用 `mobile/` 新建 Expo 52 TypeScript 移动端工程。
-   按现有 `frontend/` 页面和 mock 数据迁移首页、聊天、时间轴、画像、定制五个页面。
-   实现项目名称/描述编辑、任务新增/完成/删除、主题切换和本地持久化。
-   实现类型安全 API 客户端、mock 模式、会话 ID 持久化、统一安全错误处理。
-   接入聊天、生活事件、周报列表/生成/详情、SVG 海报分享。
-   新增语音输入 UI 和服务端 StepFun Provider 适配。转写结果只回填输入框，不自动发送。
-   使用 Expo prebuild 生成 Android 原生工程，并构建 Release APK。Release 包内置 JS bundle，不依赖 Metro。

## 修改文件

文件路径：

-   `mobile/`：Expo 工程、导航、页面、API、mock、语音、海报分享和测试。
-   `backend/main.py`：新增 `POST /api/v1/speech-to-text`。
-   `backend/services/speech_service.py`：语音校验、Provider 调用和安全错误映射。
-   `backend/core/providers/stepfun_speech_provider.py`：StepFun SSE/JSON 响应适配。
-   `backend/core/settings.py`、`backend/core/composition_root.py`：语音配置和依赖注入。
-   `backend/schemas/speech_schema.py`、`backend/tests/test_speech_service.py`：接口模型和 Fake Provider 测试。
-   `backend/.env.example`：脱敏语音配置项。
-   `.gitignore`：排除环境变量、依赖、录音、Expo/Android 构建缓存和 APK 构建目录。

修改内容：移动端只通过 HTTP API 访问后端；没有访问 PostgreSQL、pgvector、LLM 或 Agent。后端语音链路遵循 `FastAPI -> SpeechService -> StepFunSpeechProvider`。

影响范围：新增移动端和语音适配；既有聊天、时间轴、画像、周报 API 契约保持不变。

------------------------------------------------------------------------

# 三、当前系统状态

## 已完成链路

用户输入

↓

Expo 移动端五项导航和原网页端核心 UI

↓ HTTP API

FastAPI

↓

Agent / Service / Tool / Database（既有后端链路）

语音输入链路：

录音文件（Android `.m4a` / `audio/m4a`）

↓ `POST /api/v1/speech-to-text`

FastAPI -> SpeechService -> StepFunSpeechProvider

↓

转写文字回填聊天输入框

## 未完成模块

-   已完成 Android 模拟器安装启动验收，尚未取得实体 Android 手机和 iOS 设备验收结果。
-   本次使用本机 Docker PostgreSQL/pgvector/Redis 完成真实验收；共享云数据库和云端后端部署留待后续阶段。
-   StepFun 真实网络转写尚未用实体设备录音执行；客户端录音、权限、multipart 上传和后端 Provider 已实现，真实 key 未进入源码、handoff 或 APK。

------------------------------------------------------------------------

# 四、遇到的问题

问题：Debug APK 独立启动后依赖 Metro，直接安装会出现白屏。

原因：Expo Debug 包默认等待开发服务器提供 JavaScript bundle。

解决方案：使用 `assembleRelease` 生成内置 JS bundle 的 Release APK，并重新安装验证。

问题：Windows 中文路径触发 Android Gradle 路径检查。

解决方案：保留 `mobile/android/gradle.properties` 的路径兼容配置；因 Ninja 仍解析中文绝对路径，最终从等价的 ASCII 临时构建目录 `D:\LifeStewardMobileBuild` 构建，APK 与仓库源码一致。

问题：`@react-native-async-storage/async-storage` 会引入当前环境未缓存的 Android KSP 依赖。

解决方案：改用 Expo `expo-file-system` 保存会话 ID 和工作区 JSON，保持移动端离线状态持久化且不改变后端契约。

------------------------------------------------------------------------

# 五、接口变化记录

新增：

-   `POST /api/v1/speech-to-text`，multipart 字段：`audio`、`user_id`、`language`。
-   后端配置：`SPEECH_TO_TEXT_BASE_URL`、`SPEECH_TO_TEXT_API_KEY`、`SPEECH_TO_TEXT_MODEL`、`SPEECH_TO_TEXT_TIMEOUT`。
-   移动端 API 方法：`postChat`、`getLifeEvents`、`transcribeAudio`、`listWeeklyReports`、`generateWeeklyReport`、`getWeeklyPosterUri`。

修改：

-   移动端只从 `EXPO_PUBLIC_API_BASE_URL` 读取地址；未配置地址时使用 GitHub 同源 mock 数据进行页面验收。
-   相对 `poster_url` 统一解析为完整 URL；周报海报按 `image/svg+xml` 获取和分享。

删除：无。

------------------------------------------------------------------------

# 六、明日开发建议

下一步：

-   使用云端后端替换临时隧道地址，重新构建生产 APK；临时隧道关闭后当前 APK 的真实接口不可用。
-   在 Android 真机验证麦克风授权、`.m4a` 录音上传和 StepFun 真实转写。
-   为 Android 发布包配置正式签名 keystore，并在实体设备补做正式 E2E。

优先级：P0 为真实后端和实体 Android 设备验收，P1 为周报/海报异常场景复验。

负责人：李浩天（移动端）；成员一负责语音服务真实配置和联调，成员三负责周报及 Agent 工作流的最终合入和验收。

------------------------------------------------------------------------

# 七、Git记录

Branch：`codex/feature_day7_expo_mobile_final`

Commit：待本次 handoff 提交后填写。

基线：本分支基于 `origin/main` 的现有代码创建；本次未改动 `LifeSteward-main` 下载目录。

Expo：SDK 52，React Native 0.76.9。

Node/npm：Node.js LTS（npm 运行时），依赖由 `mobile/package-lock.json` 锁定。

Android：Android Studio JBR，Android SDK `D:\Program\Android\sdk`，AVD `Medium_Phone_API_36.1`，Android 16。

公网临时联调：后端监听 `0.0.0.0:8000`，临时 HTTPS 地址为 `https://open-pants-teach.loca.lt`；隧道进程关闭后地址失效。该地址只用于本次体验，不是生产部署地址。

测试结果：移动端 `npm run typecheck` 通过，单元测试 5/5 通过；后端数据库集成测试 6/6 通过，完整后端测试 127 通过、1 项因 `LIFE_STEWARD_E2E` 未启用而 skip。Expo Doctor 18/18 和 Expo Web export 已在源码提交时通过。

真实数据库证据：migration 执行成功，pgvector `0.8.6` 可用；七张核心表和 `weekly_reports` 存在。公网聊天 3 次返回 200，Agent 解析并持久化 4 条 `user_id=10001` 事件；对应 4 条 memory 均有 embedding，维度统一为 `1024`。周报生成返回 `report_id=5`，海报返回 `200 image/svg+xml`。

API 配置：`mobile/.env` 仅保存 `EXPO_PUBLIC_API_BASE_URL` 和 `EXPO_PUBLIC_API_MODE=real`；后端真实 PostgreSQL、Redis、LLM、DashScope embedding、StepFun speech 配置只在本机 `backend/.env`，没有提交任何真实密钥。

APK：`D:\Codex\黑客松\mobile\android\app\build\outputs\apk\release\app-release.apk`

APK SHA-256：`A6985977954985A81995772F4B30CFBA747027CEB1D18698A792DCE97C3748F2`

APK 验收：Release APK 由本次公网配置源码构建，bundle 已确认包含临时公网地址；安装到 `Medium_Phone_API_36.1` 成功，独立启动显示与 GitHub 网页端一致的首页，Logcat 无 `FATAL EXCEPTION`、`AndroidRuntime` 或 React Native JS 崩溃。

安全：真实语音 API key 只保留在本机未跟踪配置中，未提交到 GitHub、handoff 或 APK；对话中公开过的 key 完成后应立即轮换。
