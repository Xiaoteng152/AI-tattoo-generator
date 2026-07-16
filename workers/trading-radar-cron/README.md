# Trading Radar Cron Worker

每 15 分钟调用生产环境的 `/api/trading-radar/sync`，只负责调度，不连接 Supabase，也不持有 X / AI / Telegram 凭证。

## 配置

1. 在 Cloudflare Dashboard 或 `wrangler.toml` 设置 `TRADING_RADAR_SYNC_URL`，例如 `https://your-domain.com/api/trading-radar/sync`。
2. 执行 `wrangler secret put CRON_SECRET`，值需与 Vercel 上的 `CRON_SECRET` 相同。
3. 部署：`wrangler deploy`。

## 本地模拟

```bash
cd workers/trading-radar-cron
TRADING_RADAR_SYNC_URL=http://localhost:3000/api/trading-radar/sync \
CRON_SECRET=your-local-secret \
npx wrangler dev --test-scheduled
```

## 调度来源

采用 Cloudflare Cron 的环境应移除 Vercel 15 分钟 Cron，避免重复触发。手动“立即刷新”仍走同一 Sync API。
