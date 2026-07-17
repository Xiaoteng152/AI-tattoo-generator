# Trading Radar Cron Worker

每 15 分钟调用生产环境的 `/api/trading-radar/sync`，只负责调度，不连接 Supabase，也不持有 X / AI / Telegram 凭证。

## 配置

生产环境只使用 Cloudflare Worker secrets，不在 Dashboard 普通变量和 `wrangler.toml` 之间维护重复配置：

```bash
cd workers/trading-radar-cron
npx wrangler secret put TRADING_RADAR_SYNC_URL
npx wrangler secret put CRON_SECRET
npx wrangler deploy
```

- `TRADING_RADAR_SYNC_URL`：生产 Sync API 完整地址，例如 `https://your-domain.com/api/trading-radar/sync`。
- `CRON_SECRET`：必须与 Vercel 上的 `CRON_SECRET` 完全相同。
- Worker 不连接数据库，也不持有 X、AI 或 Telegram 凭证。

## 本地模拟

在 `workers/trading-radar-cron/.dev.vars` 写入以下内容。该文件已被 Git 忽略：

```dotenv
TRADING_RADAR_SYNC_URL="http://localhost:3000/api/trading-radar/sync"
CRON_SECRET="your-local-secret"
```

然后从仓库根目录运行：

```bash
npm run worker:dev
curl "http://localhost:8787/cdn-cgi/handler/scheduled"
```

发布前运行 `npm run worker:check`，它会执行 Worker 测试、类型检查和 Wrangler dry-run。

## 调度来源

采用 Cloudflare Cron 的环境应移除 Vercel 15 分钟 Cron，避免重复触发。手动“立即刷新”仍走同一 Sync API。
