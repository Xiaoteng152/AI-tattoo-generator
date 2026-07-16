# PRD：Vercel + Supabase + Next.js 后端部署方案

Status: ready-for-agent

## 1. 结论

Vercel + Supabase + Next.js 可以作为 Growth Automation Harness MVP 的生产演示栈。

推荐定位：

- **Next.js on Vercel**：承载 Dashboard、DeepSearch UI、Route Handlers、手动触发 API、轻量导出 API。
- **Supabase Postgres**：承载 Prisma 管理的业务数据库，保存 Workflow Config、Workflow Run、Raw Item、Normalized Item、Enrichment、Opportunity、Output Asset、DeepSearch Run 和 Report。
- **Vercel Cron**：只用于触发低频、短时的 workflow 扫描，不承载复杂调度系统。
- **Cloudflare Worker Cron**：只作为交易博主雷达在 Vercel Hobby 上的 15 分钟外部调度器，不保存业务数据，也不直接连接 Supabase。
- **Auth.js Google OAuth**：MVP 阶段继续使用当前代码里的 Auth.js，不在本阶段切换到 Supabase Auth。
- **Supabase Storage**：暂不作为 MVP 必需项。Markdown/CSV 可以先由 API 动态生成或保存在 `OutputAsset.content`。

这套方案适合当前作品集 MVP：部署简单、PostgreSQL 能托管、Next.js 前后端一体、演示链路清晰。但它不适合直接承载长时间运行的 crawler、常驻队列 worker 或高频大规模数据采集。

## 2. 为什么可行

### 2.1 与当前代码匹配

当前仓库已经具备：

- Next.js App Router。
- Prisma + PostgreSQL datasource。
- `WorkflowConfig`、`WorkflowRun`、`RawItem`、`NormalizedItem`、`Enrichment`、`Opportunity`、`OutputAsset` 等核心模型。
- `DeepSearchRun`、`DeepSearchPlan`、`DeepSearchQuestion`、`EvidenceBundle`、`DeepSearchReport` 的持久化雏形。
- `POST /api/workflow-runs` 和 `POST /api/deepsearch` 这样的 Route Handler 入口。
- Auth.js Google OAuth 相关代码。

因此 Supabase 不需要改变领域模型。它只替代本地 Docker PostgreSQL，成为线上托管 Postgres。

### 2.2 与 MVP 范围匹配

MVP 的核心不是大规模自动爬取，而是证明一个窄闭环：

```txt
配置工作流
  -> 提取 Reddit / X / Etsy 信号
  -> 保存 Raw Item
  -> 归一化
  -> AI 增强
  -> 机会排序
  -> 生成 SEO brief / 内容资产
  -> 人工审核 / 导出
```

这个闭环可以由 Next.js Route Handler 同步触发完成，只要控制每次抓取数量、DeepSearch 深度和模型调用次数。

## 3. 架构分层

### 3.1 Frontend Layer

部署在 Vercel：

- `/`：Dashboard。
- `/deepsearch`：DeepSearch 工作台。
- `/login`：Google OAuth 登录页。
- 后续页面：Run Detail、Opportunity Inbox、Output Assets。

前端只负责交互、状态展示和 API 调用，不直接持有外部 API key。

### 3.2 API Layer

使用 Next.js Route Handlers：

- `POST /api/workflow-runs`：手动运行 MVP workflow。
- `GET /api/workflow-runs`：读取最近 workflow runs。
- `GET /api/workflow-runs/[id]`：读取单次 workflow 详情。
- `POST /api/deepsearch`：运行 DeepSearch。
- `GET /api/deepsearch-runs`：读取历史 DeepSearch runs。
- `GET /api/deepsearch-runs/[id]`：读取单次 DeepSearch 详情。
- `POST /api/backtests`：连接器回测。

涉及 Prisma、外部 API 或模型调用的 Route Handler 必须使用 Node.js runtime，不能假设 Edge runtime 可用。

### 3.3 Persistence Layer

Supabase Postgres 作为唯一线上业务数据库：

- Prisma schema 继续作为数据库结构的来源。
- Migration 由本地或 CI 执行，不在 Vercel 函数运行时执行。
- 生产环境必须区分应用连接与 migration 连接：
  - `DATABASE_URL`：应用运行时使用的 pooled connection。
  - `DIRECT_URL`：migration / Prisma Studio / schema push 使用的 direct connection。
- Prisma datasource 建议调整为：

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 3.4 Auth Layer

MVP 阶段继续使用 Auth.js Google OAuth：

- 原因：当前仓库已有 Auth.js 代码，迁移到 Supabase Auth 对核心增长闭环没有直接收益。
- DeepSearch、运行 workflow、导出资产等写操作需要登录。
- Dashboard 只读预览可以按演示需要决定是否开放。

未来如果需要邀请团队、组织空间或 Supabase Row Level Security，再评估切换或接入 Supabase Auth。

### 3.5 Scheduling Layer

Vercel Cron 只负责低频触发：

- 每日或每数小时触发一个受控 workflow。
- Cron 调用内部 API，例如 `POST /api/workflow-runs?source=cron`。
- API 内必须校验 `CRON_SECRET`，避免公开触发。

不在 MVP 阶段实现复杂调度编排。`WorkflowConfig.schedule` 可以先作为配置字段保存，真正的多任务调度后续再做。

交易博主雷达是频率上的特例：

- Vercel Hobby 环境由 Cloudflare Worker Cron 每 15 分钟调用受保护的 Sync API。
- Worker 只保存生产 Sync API 地址和 `CRON_SECRET`，不保存 X、AI、Telegram 凭证或任何业务数据。
- 交易雷达仍只写入 Supabase Postgres；不使用 D1、Hyperdrive、KV、R2 或双写。
- 如果环境升级到支持 15 分钟 Vercel Cron 的套餐，可以切回 Vercel Cron，但同一环境只能启用一个调度来源。

## 4. 关键限制

### 4.1 不要在 Vercel 函数里跑常驻 worker

当前项目依赖里已有 BullMQ / Redis，但 Vercel serverless 函数不适合承载常驻队列消费者。

MVP 决策：

- 本地可以保留 worker 概念和 BullMQ 依赖。
- 线上 Vercel 部署先不运行常驻 worker。
- 工作流先由 Route Handler 同步执行，并限制数据量。
- 如果 DeepSearch 或 Connector 运行时间变长，再引入独立 worker 托管方案，例如 Fly.io、Render、Railway、ECS，或使用托管队列加回调式任务。

### 4.2 控制长任务

DeepSearch 和真实 Connector 可能因为网络、限流、模型调用而变慢。

MVP 必须限制：

- `limitPerSource` 默认 3 到 5。
- DeepSearch 默认 `standard`，`deep` 只在登录用户手动触发时开放。
- 单次运行最多 2 层 gap-filling。
- 失败步骤必须写入 run state，不能让页面整页失败。
- API 返回 `runId`，即使部分步骤失败，用户也能回看已保存结果。

### 4.3 Supabase 不是爬虫运行环境

Supabase Postgres 负责保存数据，不负责大量抓取任务。

不要把 Reddit、TikTok、Pinterest、Etsy 等 Connector 的复杂抓取逻辑塞进数据库函数。Connector 仍属于 Extraction layer，由 Next.js API 或后续 worker 调用。

### 4.4 Supabase Auth 不作为本阶段目标

使用 Supabase 不等于必须使用 Supabase Auth。当前目标是把持久化和部署跑通，不要同时引入认证迁移、RLS 策略和用户组织模型。

## 5. 环境变量

Vercel Production / Preview 环境需要配置：

```txt
DATABASE_URL=Supabase pooled connection string
DIRECT_URL=Supabase direct connection string
AUTH_SECRET=Auth.js secret
AUTH_URL=https://your-vercel-domain
GOOGLE_CLIENT_ID=Google OAuth client id
GOOGLE_CLIENT_SECRET=Google OAuth client secret
OPENAI_API_KEY=OpenAI or compatible API key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
CONNECTORS_MODE=hybrid
TWITTER_SOURCE=sopilot
SOPILOT_HOT_TWEETS_URL=https://sopilot.net/rss/hottweets
X_BEARER_TOKEN=optional
ETSY_API_KEY=optional
CRON_SECRET=secret for scheduled calls
```

本地环境继续使用 Docker PostgreSQL：

```txt
DATABASE_URL=postgresql://growth:growth@localhost:5432/growth_harness?schema=public
DIRECT_URL=postgresql://growth:growth@localhost:5432/growth_harness?schema=public
```

## 6. 数据库上线流程

1. 在 Supabase 创建项目。
2. 从 Supabase 获取 pooled connection string 和 direct connection string。
3. 在 Vercel 配置 `DATABASE_URL` 和 `DIRECT_URL`。
4. 本地 `.env` 临时指向 Supabase direct connection。
5. 执行 `npm run db:migrate`。
6. 执行 `npm run db:generate`。
7. 在 Vercel 部署前执行 `npm run typecheck` 和 `npm run lint`。
8. 部署到 Vercel。
9. 打开 Dashboard，确认数据库可达。
10. 登录后运行一次 Workflow 和一次 DeepSearch。

## 7. API 运行策略

### 7.1 Workflow Run

`POST /api/workflow-runs` 可以同步执行，但要保持小批量：

- 每个 source 默认最多 3 到 5 条。
- 保存每一步状态。
- 失败时保留已完成步骤。
- 返回 run summary。

### 7.2 DeepSearch

`POST /api/deepsearch` 必须先创建 run record：

1. 创建 `DeepSearchRun(status=RUNNING)`。
2. 保存 query understanding。
3. 保存 plan 和 questions。
4. 每个 agent 完成后保存 evidence bundle。
5. 保存 report。
6. 更新 status 为 `COMPLETED` 或 `FAILED`。
7. 返回 `runId` 和当前 result。

如果运行时间接近平台限制，前端应显示 run id，并允许用户稍后刷新读取历史结果。

### 7.3 Backtest

`POST /api/backtests` 可以保留为轻量诊断接口：

- 不要求写入数据库。
- 用于验证 Connector 与 Enrichment 能否工作。
- 生产环境可要求登录，避免公开消耗 API quota。

## 8. 分阶段实施

### Phase 1：Supabase Postgres 接入

- 给 Prisma datasource 增加 `directUrl`。
- 在 `.env.example` 增加 `DIRECT_URL`、`CRON_SECRET`、Vercel/Supabase 注释。
- 在 Supabase 建库并运行 migration。
- Vercel 配置环境变量。
- 确认 Dashboard 可以读取线上数据库。

### Phase 2：Vercel 部署可用

- 确认所有 Prisma API 使用 Node.js runtime。
- 确认 Auth.js 在 Vercel 域名下可登录。
- 保护 DeepSearch 和写操作 API。
- 跑通 `Run Workflow`、`Backtest`、`DeepSearch`。

### Phase 3：历史数据和演示闭环

- 新增 workflow run detail API。
- 新增 DeepSearch run list/detail API。
- Dashboard 显示最近 workflow 和 DeepSearch 历史。
- Output Asset 支持 Markdown / CSV 导出。

### Phase 4：受控调度

- 增加 `CRON_SECRET` 校验。
- 配置 Vercel Cron 每日触发一个默认 workflow。
- 记录 cron triggered run 的 source。
- 失败时在 Dashboard 显示 partial success / failed。

### Phase 5：长任务升级预留

只有当真实运行超过 Vercel 同步请求边界时再启动：

- 引入独立 worker 托管。
- 将 workflow / deepsearch 改为异步任务。
- API 只负责创建 run 和查询状态。
- Worker 负责执行 Connector、AI Enrichment 和 Report generation。

## 9. 不建议现在做的事

- 不要把所有业务逻辑迁到 Supabase Edge Functions。
- 不要在 Vercel 上启动 BullMQ worker。
- 不要同时切换 Supabase Auth、RLS、多租户和组织模型。
- 不要把 TikTok、Pinterest、YouTube 全部接入后再上线。
- 不要先做全自动发布或自动触达。
- 不要把 Prompt、模板和 Connector 配置硬编码到 API route。

## 10. 验收标准

- Vercel 部署后，Dashboard 能加载线上 Supabase 数据。
- 登录用户可以运行 DeepSearch。
- `POST /api/workflow-runs` 能创建线上 `WorkflowRun`、`RunStep`、`RawItem`、`NormalizedItem`、`Opportunity` 和 `OutputAsset`。
- `POST /api/deepsearch` 能创建线上 `DeepSearchRun` 并保存 report。
- 数据库不可用时，页面显示明确错误，不白屏。
- 环境变量缺失时，Connector 使用 mock/hybrid fallback 或返回可理解错误。
- 连续运行两次 workflow 后，旧 run 的 evidence 链路不被新 run 覆盖。

## 11. 参考资料

- Supabase Prisma guide: https://supabase.com/docs/guides/database/prisma
- Vercel Functions docs: https://vercel.com/docs/functions
- Vercel Cron Jobs docs: https://vercel.com/docs/cron-jobs
- Next.js Route Handlers docs: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
