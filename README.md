# Growth Automation Harness MVP

Local MVP for the AI tattoo generator demo vertical.

## What It Does

- Seeds a workflow config for `AI tattoo generator`.
- Extracts Reddit evidence through public JSON search.
- Extracts Etsy evidence through Etsy Open API v3 when `ETSY_API_KEY` is configured.
- Saves Raw Items and Normalized Items.
- Runs OpenAI-compatible enrichment when `OPENAI_API_KEY` exists, with rule-based fallback.
- Generates Markdown SEO briefs as Output Assets.
- Shows the latest run, opportunity stack, generated asset, and connector backtest in the Next.js dashboard.

## Run Locally

```bash
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`, then click `Run MVP workflow`.

`Run MVP workflow` requires PostgreSQL because it writes to Prisma tables. `回测 API 连接` does not require PostgreSQL and can be used first to validate Reddit/Etsy/AI connectivity.

## Real API Setup

```bash
CONNECTORS_MODE="hybrid"
ETSY_API_KEY="your_etsy_keystring"
OPENAI_API_KEY="your_openai_or_compatible_key"
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4o-mini"
```

Connector modes:

- `mock`: only bundled demo data.
- `hybrid`: real Reddit, real Etsy only when `ETSY_API_KEY` exists, otherwise mock Etsy.
- `real`: real Reddit and real Etsy; missing keys fail fast.

Backtest endpoint:

```bash
curl -X POST http://localhost:3000/api/backtests \
  -H "Content-Type: application/json" \
  -d '{"limitPerSource":4,"lookbackDays":30}'
```

## Useful Commands

```bash
npm run db:generate
npm run typecheck
npm run lint
npm run build
```
