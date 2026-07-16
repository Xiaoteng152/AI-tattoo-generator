# Cloudflare 定时同步交易雷达

Status: ready-for-agent
Type: AFK

## Parent

交易博主雷达 PRD：`../PRD.md`

## What to build

新增一个最小 Cloudflare Worker Cron，每 15 分钟调用生产环境受保护的交易雷达 Sync API。Worker 只承担调度，不连接 Supabase，不保存业务数据，也不持有 X、AI 或 Telegram 凭证。

Worker 使用部署变量保存生产 Sync API 地址，使用 Secret 保存与 Next.js 相同的 Cron Secret，并通过 Bearer Authorization 调用接口。非成功响应必须被记录为失败，方便在 Cloudflare 日志中定位，但不得把 Secret 或响应中的敏感数据写入日志。

采用 Cloudflare Cron 的环境必须移除或禁用同频率 Vercel Cron，保证只有一个调度来源。手动“立即刷新”仍复用同一同步服务，不建立第二条同步实现。

## Acceptance criteria

- [ ] Worker 的 Cron 表达式为每 15 分钟执行一次，并调用配置的生产 Sync API。
- [ ] 请求通过 `Authorization: Bearer <CRON_SECRET>` 鉴权；目标 URL 与 Secret 均不硬编码。
- [ ] Worker 不包含 Supabase 连接、Prisma、X Token、OpenAI Key 或 Telegram 凭证。
- [ ] API 返回非 2xx 或网络失败时，Worker 以失败结果结束并输出不含 Secret 的最小诊断日志。
- [ ] 仓库不再启用 15 分钟 Vercel Cron；文档明确同一环境只能选择一个调度来源。
- [ ] Sync API 拒绝缺失或错误 Secret，并接受正确 Secret；Google 会话仍可执行手动刷新。
- [ ] 重复触发同步不会重复保存 Creator Raw Item，也不会重复发送同一 Digest 的 Telegram 消息。
- [ ] 提供本地模拟 scheduled event 的说明，但不要求后续 Agent 登录或部署到真实 Cloudflare 账号。
- [ ] `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`npx prisma validate` 全部通过。
- [ ] 不执行生产部署、不运行生产 `db:deploy`、不写入真实 Supabase 数据。

## Blocked by

None - can start immediately.

## User stories covered

- 17、18：15 分钟自动同步和手动刷新。
- 44：重复触发不造成重复推送。
- 48、50：配置错误和同步失败可被明确诊断。
- 54：Cloudflare 不形成第二份业务数据。

## Comments

- 2026-07-16：从已确认的 Cloudflare 调度边界与上线操作清单拆分，交给后续 Agent 完成。
