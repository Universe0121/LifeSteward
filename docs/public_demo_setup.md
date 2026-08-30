# LifeSteward 本地公网演示

本目录的启动脚本用于本机演示环境：Docker 提供 PostgreSQL/pgvector 和 Redis，
FastAPI 监听 `0.0.0.0:8000`，脚本优先使用 Cloudflare Quick Tunnel，localhost.run SSH 隧道和 localtunnel 作为备用，提供临时 HTTPS 地址。临时隧道不是生产部署，
第三方服务或本机休眠仍可能导致地址失效；守护进程会自动恢复本机进程并把新地址写入本地运行目录。

## 准备

在 `D:\Codex\黑客松\backend\.env` 中填写本机配置。该文件被 `.gitignore` 排除，真实密码和 API key 不得写进代码、APK、日志或 handoff。
至少需要 `POSTGRES_DSN`、`REDIS_URL`、LLM provider 和对应模型 key。语音配置是可选能力，缺失时文字聊天仍可用。

首次启动会在被忽略的 `.lifesteward-runtime` 中自动下载官方 `cloudflared-windows-amd64.exe`。如果 GitHub 下载不可用，脚本会依次尝试系统中的 `ssh.exe`/localhost.run 和 `npx localtunnel`。也可以通过 `LIFESTEWARD_CLOUDFLARED_PATH` 在 `backend\.env` 指定已有的 cloudflared 路径。

## 启动

在仓库根目录执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\start_public_demo.ps1
```

脚本会依次：

1. 检查 Docker Desktop 并执行 `docker compose up -d`，不删除数据卷。
2. 等待 PostgreSQL 和 Redis 健康检查通过。
3. 执行 `backend\migrations\001_initial_memory_schema.sql` 和 `002_weekly_reports.sql`。
4. 启动 `python -m uvicorn main:app --host 0.0.0.0 --port 8000`。
5. 通过 Cloudflare Quick Tunnel 建立临时 HTTPS 地址；连接失败时自动回退到 localhost.run，再回退到 localtunnel，并在固定子域名不可用时改用随机子域名。
6. 启动隐藏守护进程，检查后端和公网 `/health/live`，进程退出、隧道断开或隧道返回 503 时自动重启。

输出的公网地址写入 `.lifesteward-runtime\public-url.txt`，该目录已被忽略。移动端可以在“定制”页输入该地址并点击“测试连接”，无需重新编译 APK。

移动端 Android 原生目录由 Expo CNG 在构建时生成，不提交到仓库。构建前执行
`npx expo prebuild --platform android --non-interactive`，这样评委使用当前
`app.json` 和锁定依赖即可得到与提交源码一致的原生工程。

指定子域名或只启动本地后端：

```powershell
.\scripts\start_public_demo.ps1 -Subdomain my-lifeagent-demo
.\scripts\start_public_demo.ps1 -NoTunnel
```

## 状态与停止

```powershell
.\scripts\check_public_demo.ps1
.\scripts\stop_public_demo.ps1
```

停止脚本只结束由启动脚本记录的后端、隧道和守护进程，默认保留 PostgreSQL/Redis 容器和数据卷。需要同时停止容器时显式执行：

```powershell
.\scripts\stop_public_demo.ps1 -StopDocker
```

## 健康接口

- `GET /health/live`：只证明 FastAPI 进程存活，不访问数据库或 Redis。
- `GET /health/ready`：检查 PostgreSQL、pgvector、八张业务表、Redis、LLM 配置和生产依赖组装状态；未就绪返回 HTTP 503。

健康响应只包含布尔状态、缺失表名和安全错误码，不返回 DSN、密码、API key 或 Python 堆栈。

## 演示地址

后端本地地址：`http://127.0.0.1:8000`。

移动端真实模式的 `EXPO_PUBLIC_API_BASE_URL` 或“定制”页运行时地址应填写脚本输出的完整 `https://...trycloudflare.com`、`https://...lhr.life` 或 `https://...loca.lt`，不要填写 `/api` 后缀。临时地址变化时重新测试并保存即可；真正固定的公网地址需要云服务器或 Cloudflare Named Tunnel。

Quick Tunnel 的域名每次重建可能变化，免费临时服务也不能承诺永久在线。启动脚本和 watcher 会在本机进程、依赖或隧道断开时自动恢复，并把新地址写入 `.lifesteward-runtime\public-url.txt`；手机端在“定制”页测试并保存新地址即可，无需重新编译 APK。

网页端开发服务器仍在 `frontend` 目录启动：

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

网页端通过 `VITE_API_BASE_URL` 或 `VITE_API_BASE` 指向后端根地址，客户端会自动补上 `/api`；未设置时使用同源 `/api` 代理。代理目标可用 `VITE_DEV_API_TARGET` 覆盖。
