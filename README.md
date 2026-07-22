# Growth Automation Harness

面向海外 C 端产品增长的自动化平台 MVP。当前演示垂类固定为 **AI tattoo generator**（AI 纹身生成器），用一条可复现的增长工作流，把 Reddit、X/Twitter、Etsy 等渠道的市场信号，转成运营可直接使用的 SEO brief 与机会清单。

更完整的产品链路与模块说明见 [docs/product-flow.md](docs/product-flow.md)；Agent 与领域词汇见 [CONTEXT.md](CONTEXT.md)、[AGENTS.md](AGENTS.md)。

---

## 项目定位

这不是单纯的爬虫或 Prompt 工具，而是一个 **Growth Automation Harness**：帮助增长团队从「手动刷热点、拼表格」升级为「配置一次、反复执行」的标准化流程。

平台要解决的核心问题：

1. **发现**：从社区讨论、电商 listing、社媒热点里找到真实痛点与商业信号。
2. **理解**：用 AI（或规则回退）把非结构化内容变成痛点、意图、趋势类型、关键词与内容角度。
3. **排序**：按互动与证据强度给机会打分，让运营先处理高价值项。
4. **产出**：生成 Markdown SEO brief 等可审核的增长资产。
5. **深挖**：对单个机会启动 DeepSearch，做多步检索、证据聚合与研究摘要（需 Google 登录）。
6. **验证**：在不写库的情况下回测 Connector 与增强链路是否可用。

第一个作品集演示选择 **AI tattoo generator**，是因为该垂类能自然串联：Reddit 用户痛点、Etsy 商品需求、视觉/内容趋势、SEO 页面机会，以及后续的 KOC/KOL 触达方向。

---

## 当前 MVP 能力

| 能力 | 说明 |
| --- | --- |
| Workflow Config | 种子配置固定产品方向与关键词（`AI tattoo generator`） |
| Reddit Connector | 通过公开 JSON 搜索提取讨论与痛点证据 |
| X/Twitter Connector | 默认走 SoPilot 热推 RSS；可切换 X API v2 Recent Search |
| Etsy Connector | 配置 `ETSY_API_KEY` 后走 Etsy Open API v3 |
| 原始与归一化 | 写入 Raw Items、Normalized Items（标题、正文、标签、互动分等） |
| Enrichment | 有 `OPENAI_API_KEY` 时走 OpenAI 兼容接口；否则规则回退 |
| Opportunity 评分 | 基于证据与互动生成可排序的机会栈 |
| Output Asset | 生成 Markdown SEO brief |
| Dashboard | Next.js 首页展示最近运行、机会栈、资产与回测入口 |
| Backtest | 不依赖 PostgreSQL，可单独验证数据源与分析是否连通 |
| DeepSearch | `/deepsearch` 围绕单个机会继续规划问题、拉证据、出研究报告（需 OAuth） |
| Trading Radar | `/trading-radar` 监控自定义 X 博主，记录未读，并生成有原文证据的精简交易信号（需 OAuth） |

连接器模式（`CONNECTORS_MODE`）：

- `mock`：仅内置演示数据。
- `hybrid`（推荐）：真实 Reddit；X 默认 SoPilot；Etsy 有 key 才走真实 API。
- `real`：全部走真实源；缺 key 会快速失败。

---

## 技术栈

- **应用**：Next.js 16、React 19、Tailwind CSS 4
- **数据**：PostgreSQL + Prisma
- **队列**（可选）：BullMQ + Redis（worker 脚本）
- **认证**：Auth.js v5（Google OAuth，JWT 会话）
- **AI**：OpenAI 兼容 HTTP API（可配置 `OPENAI_BASE_URL` / `OPENAI_MODEL`）

---

## 本地运行

```bash
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run dev
```

浏览器打开 `http://localhost:3003`，点击 **Run MVP workflow** 触发完整工作流（需 PostgreSQL 与迁移成功）。

首次建议先点 **回测 API 连接**，无需数据库即可检查 Reddit / Etsy / AI 等链路。

安装 Git 提交校验（标题单行不超过 15 字）：

```bash
npm run hooks:install
```

---

## Google 登录（DeepSearch）

DeepSearch（`/deepsearch`）与 `POST /api/deepsearch` 需要 Google OAuth。首页 Dashboard 仍公开；顶栏 **Sign in with Google** 跳转 `/api/auth/signin/google`。

### Google Cloud Console

1. 打开 [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)。
2. 配置 [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)（本地开发用 External 即可，把自己的 Google 账号加为测试用户）。
3. 创建 **OAuth 2.0 Client ID** → 类型：**Web application**。
4. **Authorized redirect URIs** 填写：`http://localhost:3003/api/auth/callback/google`
5. 将 Client ID / Secret 写入 `.env.local`（见下）。

### `.env.local`（Auth.js v5）

```bash
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_GOOGLE_ID="1234567890-abcdef.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-xxxxxxxx"
AUTH_URL="http://localhost:3003"
```

也支持旧变量名 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`。修改 env 后需重启 `npm run dev`。凭证缺失时 `/login` 会显示中文配置清单，而不是 Configuration 500。

### 验证

```bash
curl -s http://localhost:3003/api/auth/providers | jq .
open http://localhost:3003/login
```

**网络说明**：登录时会请求 `accounts.google.com` 的 OpenID 配置。若已配置凭证仍出现 `TypeError: fetch failed`，多为本机无法访问 Google，需 VPN/代理或换网络。

会话为 JWT 策略（暂无 Prisma User 表）。服务端可用 `auth()`（`@/auth`）。

---

## 真实 API 配置示例

```bash
CONNECTORS_MODE="hybrid"
TWITTER_SOURCE="sopilot"
SOPILOT_HOT_TWEETS_URL="https://sopilot.net/rss/hottweets"
X_BEARER_TOKEN="your_x_api_v2_bearer_token"
ETSY_API_KEY="your_etsy_keystring"
OPENAI_API_KEY="your_openai_or_compatible_key"
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4o-mini"
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_personal_chat_id"
```

X/Twitter 默认用 SoPilot RSS，再按关键词过滤。若改用官方 API：设 `TWITTER_SOURCE="x-api"` 并配置 `X_BEARER_TOKEN`（受套餐、限流与 recent-search 时间窗约束）。

Trading Radar 始终使用官方 X 用户时间线，不使用 SoPilot 兜底。添加博主时首次导入最近 10 条原创/引用推文，之后每 15 分钟使用增量游标同步。交易分析没有规则回退：必须配置 `OPENAI_API_KEY` 才会生成信号；配置 Telegram 两个变量后，明确的符合/冲突信号会被推送。

交易雷达继续使用 Supabase Postgres 作为唯一业务数据库，不使用 Cloudflare D1、Hyperdrive、KV、R2 或双写。目标部署架构中，Vercel Hobby 环境由 Cloudflare Worker Cron 每 15 分钟携带 `Authorization: Bearer $CRON_SECRET` 调用同步接口；Cloudflare 只负责调度。当前仓库仍保留待替换的 15 分钟 `vercel.json` 配置，在 Cloudflare Cron 上线前必须按操作清单移除或禁用，确保同一环境只有一个调度来源。升级到支持同频率 Cron 的 Vercel 套餐后也可以改回 Vercel Cron。

回测示例：

```bash
curl -X POST http://localhost:3003/api/backtests \
  -H "Content-Type: application/json" \
  -d '{"limitPerSource":4,"lookbackDays":30}'
```

---

## 常用命令

```bash
npm run db:generate
npm run typecheck
npm run lint
npm run build
npm run test:deepsearch
```

---

## 相关文档

- [产品链路图](docs/product-flow.md)
- [Agent 指南与 Git 规范](AGENTS.md)
- [领域上下文](CONTEXT.md)
- [版本任务路线图](task.md)
- [交易博主雷达 PRD](.scratch/creator-trading-radar/PRD.md)
- [交易博主雷达上线操作清单](.scratch/creator-trading-radar/OPERATIONS.md)
