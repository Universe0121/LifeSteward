# LifeAgent 每日开发进度记录

日期：2026-08-30

负责人：李浩天

------------------------------------------------------------------------

# 一、今日目标

在昨天 GitHub 成果的基础上完成 React Native + Expo 移动端最终收口，保持网页端原有中文界面、颜色、卡片结构和交互；修复网页端与移动端日期条在窄屏下只能看到部分日期的问题；接入真实后端接口并生成可独立安装的 Android Release APK。

------------------------------------------------------------------------

# 二、实际完成内容

## 完成模块

-   以最新 `origin/main` 为基线，在 `codex/feature_day7_expo_mobile_final` 分支完成开发；`LifeSteward-main` 下载目录未加入 Git。
-   复用 GitHub `frontend/src/pages`、`frontend/src/styles.css`、`frontend/src/mocks` 和工作区状态，迁移首页、聊天、日历、画像、定制、今日计划、任务清单、睡眠详情和周报页面。
-   网页端日历日期条和任务清单日期条均改为横向滚动：日期项固定宽度、容器使用 `overflow-x: auto`，不再因横向空间不足压缩或截断日期。
-   Expo 端对应两个日期条使用原生 `ScrollView horizontal`，启用 `nestedScrollEnabled` 和方向锁；日历提供过去 31 天，任务清单提供今天起未来 31 天，日期可滑到首尾。
-   移除今日计划每条任务右侧的三点菜单，改为直接点击任务完成/取消；“去聊天添加或调整计划”改为可用的聊天导航；任务清单支持新增、编辑、完成、删除和日期切换。
-   保留客户端仅通过 HTTP API 访问后端的边界；实现聊天、生活事件、语音转写、周报生成/读取、SVG 海报预览和分享，统一转换非 2xx 错误并隐藏后端堆栈和凭据。
-   完成语音服务端最小适配：`FastAPI -> SpeechService -> StepFunSpeechProvider`，支持 Android `.m4a`/`audio/m4a`，客户端转写结果只回填输入框、不自动发送。
-   使用 Expo prebuild 和 Gradle `assembleRelease` 生成内置 JavaScript bundle 的 Release APK，并安装到 Android 模拟器验证启动。

## 修改文件

文件路径：

-   `frontend/src/pages/Timeline.tsx`、`frontend/src/pages/TaskManagement.tsx`、`frontend/src/styles.css`：网页端日期条横向滚动和任务页面交互。
-   `mobile/src/screens/TimelineScreen.tsx`、`mobile/src/screens/TaskManagementScreen.tsx`：原生横向日期条、日期选择和任务管理界面。
-   `mobile/src/`：Expo 导航、API 客户端、页面、状态持久化、语音输入、周报海报和本地 mock 数据。
-   `frontend/src/`：复用网页端 UI 的登录、聊天、任务、计划、睡眠和周报页面及状态管理。
-   `backend/core/providers/stepfun_speech_provider.py`：补充 `webm` 音频格式识别，保持语音 Provider 的安全错误处理。
-   `mobile/tests/`：API、计划解析和任务/计划行为测试。

修改内容：移动端不访问 PostgreSQL、pgvector、LLM 或 Agent；网页端和移动端均只通过后端公开 HTTP 接口工作。真实配置仅保留在本机忽略文件中。

影响范围：前端 UI、Expo 移动端和语音适配；既有聊天、生活事件、周报 API 字段仍使用 snake_case，未修改数据库 schema 或 Agent Prompt。

------------------------------------------------------------------------

# 三、当前系统状态

## 已完成链路

GitHub 网页端 UI / Expo Android App

↓ HTTP API

FastAPI

↓

Agent -> Service -> Tool -> Database

语音链路：

Android `.m4a` 录音

↓ `POST /api/v1/speech-to-text`

FastAPI -> SpeechService -> StepFunSpeechProvider

↓

转写文字回填聊天输入框，用户确认后再发送

## 日期条验收

-   网页端默认视口：日历日期条 `clientWidth=510`、`scrollWidth=1974`；滚动到末尾可见 `8月23` 至 `今天30`。
-   网页端窄屏 `390x844`：两个日期条可视宽度均为 `327`，滚动到末尾分别可见 `今天30`、`周二29`。
-   Android 模拟器：日历首屏可见 `7月30` 至 `8月4`，左滑后可见 `8月3` 至 `8月9`；任务清单首屏可见当前日期及后续日期，左滑后可见 `9月2` 至 `9月8`。
-   Android UI dump 将两个控件识别为可滚动的 `HorizontalScrollView`，不是静态裁剪。

## 未完成模块

-   尚未取得实体 Android 手机和 iOS 设备；当前设备验收使用 `Medium_Phone_API_36.1` Android 16 模拟器。
-   当前 APK 使用临时公网隧道；隧道进程关闭或地址失效后，APK 的真实 API 请求不可用，需要云端后端地址后重新构建。
-   尚未完成云端后端部署和正式 Android 签名；当前 APK 是可安装的 Release 测试包。
-   尚未用实体设备麦克风完成 StepFun 真实 ASR 录音闭环；权限、录音资源释放、multipart 上传和服务端 Fake Provider 测试已完成。

------------------------------------------------------------------------

# 四、遇到的问题

问题：窄屏日期条只能看到中间一段日期，用户无法访问其他日期。

原因：原实现使用空间分配/固定可视区域，日期项没有形成可滚动的超出内容宽度。

解决方案：网页端设置 `overflow-x: auto`、固定子项宽度和 `flex: 0 0 auto`；移动端使用原生水平 `ScrollView`，并验证首尾日期实际可达。

问题：Debug APK 独立安装后等待 Metro，启动可能白屏。

原因：Expo Debug 包默认不内置 JavaScript bundle。

解决方案：使用 `assembleRelease` 构建内置 bundle 的 Release APK，并重新安装验证。

问题：Windows 中文路径导致 Android Ninja/CMake 路径检查失败。

原因：原生构建工具解析含中文的绝对路径不稳定。

解决方案：从等价的 ASCII 临时目录 `D:\LifeStewardMobileBuild2` 执行 prebuild/Gradle 构建；APK 内容来自本分支最终移动端源码。

问题：计划页“去聊天添加或调整计划”点击后没有反应，计划卡三点菜单操作不稳定。

原因：根 Stack 与嵌套 Tab 的导航目标不一致，且菜单操作遮挡了直接交互。

解决方案：统一通过嵌套 Tab 导航到聊天页；任务卡改为直接点击完成/取消，普通任务进入独立任务清单管理。

------------------------------------------------------------------------

# 五、接口变化记录

新增：

-   `POST /api/v1/speech-to-text`，multipart 字段：`audio`、`user_id`、`language`。
-   移动端 API 方法：`postChat`、`getLifeEvents`、`transcribeAudio`、`listWeeklyReports`、`generateWeeklyReport`、`getWeeklyPosterUri`、`getWeeklyPosterSvg`。

修改：

-   日期条 UI 行为：网页端和 Expo 端均支持横向滑动访问完整日期集合。
-   相对 `poster_url` 自动按 `EXPO_PUBLIC_API_BASE_URL` 解析；海报按 `image/svg+xml` 获取和分享。
-   API 非 2xx 响应统一转换为安全的 `ApiClientError`；页面不展示数据库、堆栈或第三方原始异常。

删除：无。

------------------------------------------------------------------------

# 六、明日开发建议

下一步：

-   部署稳定云端后端和 HTTPS 域名，将 `EXPO_PUBLIC_API_BASE_URL` 替换为云端地址后重新构建 APK。
-   在实体 Android 手机上复验麦克风权限、录音、StepFun ASR、日期条滑动、真实时间轴、周报和 SVG 海报分享。
-   配置正式签名 keystore，并在发布前执行一次干净环境安装验收。

优先级：P0 为云端后端与实体 Android 真机；P1 为真实 ASR 和周报/海报异常场景。

负责人：李浩天（移动端）；成员一负责语音服务正式配置与联调，成员三负责周报/Agent 工作流最终合入与验收。

------------------------------------------------------------------------

# 七、Git记录

Branch：`codex/feature_day7_expo_mobile_final`

Commit：`b0eafec09c38ca5db1bdf60473931c124fa5f575`（网页端与 Expo 日期条滚动修复、移动端最终 UI/交互收口）。

基线：最新 `origin/main`；未提交 `LifeSteward-main` 下载目录、参考任务文档、截图或构建缓存。

Expo：SDK 52，React Native 0.76.9，Expo CLI 0.22.28。

Node/npm：Node.js v24.19.0，npm 11.17.0；依赖由 `mobile/package-lock.json` 锁定。

Android：Android Studio JBR OpenJDK 21.0.8，Android SDK `D:\Program\Android\sdk`，AVD `Medium_Phone_API_36.1`，Android 16 / API 36，模拟器分辨率 `1080x2400`。

公网临时联调：后端监听 `0.0.0.0:8000`，当前临时 HTTPS 地址为 `https://all-cloths-hang.loca.lt`；已验证 `GET /api/v1/life-events?user_id=10001&days=7` 返回 200。该地址只用于本次体验，隧道关闭后失效，不是生产地址。

测试结果：

-   移动端 `npm run typecheck`：通过。
-   移动端 `npm test`：13/13 通过。
-   网页端 `npm run build`：通过；网页端契约测试通过。
-   后端完整测试：136 项通过，1 项因 `LIFE_STEWARD_E2E` 未启用而 skip。
-   数据库集成：6/6 通过；PostgreSQL/pgvector 真实环境可用。
-   `npx expo-doctor`：17/18 通过；唯一提示为已生成 `android/` 原生目录时仍保留 `app.json` 配置，构建流程已执行 `expo prebuild`，因此配置会同步。Expo Web export 已通过。
-   Android Release：Gradle `:app:assembleRelease` 成功（625 actionable tasks）。

真实数据证据：本机 PostgreSQL/pgvector migration 成功；七张核心表和 `weekly_reports` 存在；真实聊天数据可通过时间轴读回；embedding 维度统一为 `1024`；周报生成和 SVG 海报接口已联调。

APK：

-   交付文件：`D:\LifeAgent-day07-final.apk`
-   Gradle 输出：`D:\LifeStewardMobileBuild2\android\app\build\outputs\apk\release\app-release.apk`
-   SHA-256：`51B6C31EB2B1FA6375EE10252D3CC46070613FA205C28B779F042200994797C6`
-   安装结果：已成功安装到 `Medium_Phone_API_36.1`，Release 包可独立启动并显示登录页、首页、日历和任务清单；Logcat 未发现 `FATAL EXCEPTION`、`AndroidRuntime` 或 React Native JS 崩溃。

配置与安全：`mobile/.env`、`backend/.env` 均被 `.gitignore` 忽略；真实数据库、Redis、LLM、embedding 和语音密钥没有提交到 GitHub、handoff 或 APK。临时隧道地址不是密钥，隧道关闭后请勿继续使用旧 APK 做真实联调。
