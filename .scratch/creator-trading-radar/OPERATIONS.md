# 交易博主雷达：后续操作清单

Status: ready-for-agent

## 已确认架构

- Web 与 API：Next.js on Vercel。
- 唯一业务数据库：Supabase Postgres。
- 15 分钟调度：Cloudflare Worker Cron 调用受保护的 Next.js Sync API。
- Cloudflare 不保存博主、推文、Digest、策略或投递数据。
- 不使用 D1、Hyperdrive、KV、R2，也不做双写。

## 执行任务

- `issues/01-preserve-trading-radar-history.md`：策略快照、metrics 去重、博主停用/恢复和 migration 对齐。
- `issues/02-schedule-trading-radar-sync.md`：Cloudflare Worker Cron、单一调度来源、Cron 鉴权与幂等验证。

两个任务均为 `ready-for-agent`、AFK，可以直接交给后续 Agent。真实 Cloudflare 部署和生产数据库 migration 不包含在任务授权内。

## 一、开发 Agent 需要完成

按顺序执行，完成前一项再进入下一项。

- [ ] 对齐 Persistence layer：在 Digest 中保存 `strategySnapshot`，确保旧信号能还原当时策略。
- [ ] 删除 Creator Raw Item 中独立、重复的 metrics 存储；互动指标保留在原始 payload 即可。
- [ ] 将博主管理收敛为“停用/恢复”，移除第一版物理删除入口，保证历史推文和 Digest 来源不丢失。
- [ ] 更新尚未上线的 Prisma migration，并重新生成 Prisma Client。
- [ ] 新增最小 Cloudflare Worker Cron：每 15 分钟携带 Bearer Secret 调用生产 Sync API，不连接数据库、不持有 X/AI/Telegram 凭证。
- [ ] 在采用 Cloudflare Cron 的环境移除或禁用 15 分钟 Vercel Cron，确保只有一个调度来源。
- [ ] 补充策略快照、停用保留历史、Cron 鉴权、同步去重和 Telegram 幂等测试。
- [ ] 运行完整发布门禁：`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`npx prisma validate`。
- [ ] 在生产数据库执行 `npm run db:deploy`，不得在 Vercel 请求处理期间运行 migration。

## 二、你需要准备或配置

不要把下面的真实密钥写入仓库、PRD 或聊天记录，直接配置到对应平台的 Secret / Environment Variables。

### Supabase

- [x] `DATABASE_URL`：本地已有配置；生产环境使用 pooled connection。
- [x] `DIRECT_URL`：本地已有配置；只供 migration、Prisma Studio 等管理操作使用。
- [ ] 确认 Supabase 项目在线，且 direct connection 能从本地或 CI 访问。

### Google OAuth

- [ ] 创建或确认 Web OAuth Client。
- [ ] 配置生产回调地址：`https://<你的域名>/api/auth/callback/google`。
- [ ] 在 Vercel 配置 `AUTH_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`、`AUTH_URL`。

### X API

- [x] 本地已有 `X_BEARER_TOKEN`。
- [ ] 在 Vercel Production 配置同名变量。
- [ ] 确认当前 X API 套餐可以读取指定用户资料和用户时间线。

### AI

- [ ] 在 Vercel 配置 `OPENAI_API_KEY`。
- [ ] 按所用供应商配置 `OPENAI_BASE_URL` 和 `OPENAI_MODEL`。
- [ ] 确认模型支持可靠的 JSON 结构化输出。

### Telegram

- [ ] 创建 Telegram Bot，并先向该 Bot 发送一条消息。
- [ ] 获取 Bot Token 和个人 Chat ID。
- [ ] 在 Vercel 配置 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`。

### Cron 与部署

- [ ] 生成一个高熵 `CRON_SECRET`，同时配置到 Vercel 和 Cloudflare Worker Secret。
- [ ] 确定生产 Sync API 地址：`https://<你的域名>/api/trading-radar/sync`。
- [ ] 提供或登录 Cloudflare 账号，以便创建并部署 Cron Worker。
- [ ] 确认 Vercel Production 域名，避免 Cloudflare Cron 调用 Preview 部署。

## 三、建议上线顺序

1. Agent 完成数据模型修正和测试。
2. 在本地运行 `npm run db:generate` 和完整发布门禁。
3. 确认 Supabase direct connection 后运行 `npm run db:deploy`。
4. 在 Vercel 配齐生产环境变量并部署 Next.js。
5. 在 Google OAuth 控制台补充生产回调域名。
6. 先使用页面“立即刷新”完成一次人工联调。
7. 部署 Cloudflare Cron Worker，并确认 15 分钟触发一次。
8. 观察至少两次 Cron 执行，再开启正式 Telegram 推送验收。

## 四、首次验收脚本

- [ ] Google 登录成功，未登录无法访问交易雷达数据和写接口。
- [ ] 添加一个测试博主后，只导入最近 10 条原创或引用推文。
- [ ] 首次导入不计入新增数量，也不发送 Telegram。
- [ ] 新推文出现后，手动刷新或 Cron 只新增未见过的帖子。
- [ ] 点击推文后变为已读；仅选择博主或点击左栏预览不会标记已读。
- [ ] AI 最多分析最近 10 条未读推文，输出最多 3 条摘要和 3 个信号。
- [ ] 没有原文依据的入场价、入场时间和失效条件显示“未明确”。
- [ ] Digest 保存策略版本及策略文本快照。
- [ ] 明确的 `MATCH` 和 `CONFLICT` 信号可以推送 Telegram；首次导入、普通摘要和手动重新分析不推送。
- [ ] 重复调用同一同步入口不会重复保存推文或重复发送 Telegram。
- [ ] 停用博主后不再同步，恢复后继续增量同步，历史推文和分析仍然存在。

## 五、完成定义

只有同时满足以下条件，第一版才算可上线：

- Supabase migration 已成功应用。
- Vercel 生产构建及 Google 登录正常。
- X、AI、Telegram 三条真实链路均完成至少一次验收。
- Cloudflare Cron 连续两次成功调用生产 Sync API。
- 数据库中不存在 Cloudflare 双写路径。
- 所有信号都能回到来源推文，并明确标注不构成自动交易指令。
