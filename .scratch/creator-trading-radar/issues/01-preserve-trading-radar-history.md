# 交易雷达历史证据完整性

Status: ready-for-agent
Type: AFK

## Parent

交易博主雷达 PRD：`../PRD.md`

## What to build

完成交易博主雷达的持久化闭环，使策略更新和博主停用都不会破坏历史信号的证据链。

每个新 Digest 必须同时保存策略版本和当时的策略文本快照。策略更新后，旧 Digest 保持不变；用户显式重新分析时创建新 Digest，不覆盖旧结果。

Creator Raw Item 继续保留完整 X 原始 payload，但不再额外维护一份未被第一版使用的互动 metrics。博主管理只允许停用和恢复：停用后停止同步，恢复后沿用原增量游标，历史推文、已读状态、Digest 和 Telegram 投递记录都必须保留。

数据库变更必须遵守当前 PostgreSQL 与 Prisma 边界。不要引入 Cloudflare 数据库、第二套 Persistence layer、实时行情表或自动清理任务。

## Acceptance criteria

- [ ] 新建 Digest 时保存 `strategySnapshot`、策略版本和 Prompt 版本；读取历史 Digest 不依赖当前策略正文。
- [ ] 保存新策略只影响后续分析；强制重新分析创建新 Digest，旧 Digest 内容和快照不变。
- [ ] Creator Raw Item 不再包含独立 metrics 字段；同步流程只在原始 payload 中保留互动指标。
- [ ] 博主 API 和页面只提供停用与恢复，不暴露物理删除入口。
- [ ] 停用博主后定时与手动全量同步都跳过该博主；恢复后使用原 `newestPostId` 继续增量同步。
- [ ] 停用和恢复不会删除或重置历史推文、阅读时间、Digest 来源或投递记录。
- [ ] Prisma schema、尚未发布的 migration 和生成的 Prisma Client 保持一致。
- [ ] 若无法证明现有 migration 从未在任何共享环境应用，不得改写已应用的 migration 历史，必须创建向前 migration。
- [ ] 测试覆盖策略快照、重新分析不覆盖、metrics 不再重复写入、停用跳过同步、恢复沿用游标和历史数据保留。
- [ ] `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`npx prisma validate` 全部通过。
- [ ] 不执行生产 `db:deploy`，不修改 Supabase、Vercel 或第三方平台 Secret。

## Blocked by

None - can start immediately.

## User stories covered

- 5：停用或恢复博主并保留历史证据。
- 24、25：缓存分析并允许创建新的重新分析结果。
- 38、39、52：策略更新后历史分析仍可追溯。
- 51：关闭浏览器后仍保留监控状态。

## Comments

- 2026-07-16：从已确认的存储边界与上线操作清单拆分，交给后续 Agent 完成。
