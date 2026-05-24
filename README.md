# Growth Automation Harness MVP

Local MVP for the AI tattoo generator demo vertical.

## What It Does

- Seeds a workflow config for `AI tattoo generator`.
- Extracts Reddit evidence through public JSON search.
- Extracts X/Twitter evidence through SoPilot hot tweets RSS by default, or X API v2 Recent Search when configured.
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

## Google Sign-In

DeepSearch (`/deepsearch`) and `POST /api/deepsearch` require Google OAuth. The dashboard home page stays public; use the top-bar **Sign in with Google** button (redirects to `/api/auth/signin/google`).

### Google Cloud Console

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Configure the [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) (External is fine for local dev; add your Google account as a test user).
3. Create **OAuth 2.0 Client ID** → Application type: **Web application**.
4. Under **Authorized redirect URIs**, add exactly:
   `http://localhost:3000/api/auth/callback/google`
5. Copy **Client ID** and **Client secret** into `.env.local` (see below).

### `.env.local`

Auth.js v5 official variable names:

```bash
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_GOOGLE_ID="1234567890-abcdef.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-xxxxxxxx"
AUTH_URL="http://localhost:3000"
```

Legacy names `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are also supported.

Restart `npm run dev` after editing env. If credentials are missing, `/login` shows a Chinese setup checklist instead of a `Configuration` 500.

### Verify

```bash
# Providers list should include google when configured
curl -s http://localhost:3000/api/auth/providers | jq .

# Browser: open login, click Sign in with Google
open http://localhost:3000/login
```

### Network note

Auth.js fetches Google OpenID metadata from `https://accounts.google.com/.well-known/openid-configuration` during sign-in. If logs show `TypeError: fetch failed` at `getAuthorizationUrl` **after** credentials are set, your dev machine may not reach Google (firewall, corporate proxy, or region restrictions). Use VPN/proxy for local OAuth, or test from a network that can access `accounts.google.com`.

Session uses Auth.js JWT strategy (no Prisma User table yet). Server routes can call `auth()` from `@/auth`.

`Run MVP workflow` requires PostgreSQL because it writes to Prisma tables. `回测 API 连接` does not require PostgreSQL and can be used first to validate Reddit/Etsy/AI connectivity.

## Real API Setup

```bash
CONNECTORS_MODE="hybrid"
TWITTER_SOURCE="sopilot"
SOPILOT_HOT_TWEETS_URL="https://sopilot.net/rss/hottweets"
X_BEARER_TOKEN="your_x_api_v2_bearer_token"
ETSY_API_KEY="your_etsy_keystring"
OPENAI_API_KEY="your_openai_or_compatible_key"
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4o-mini"
```

Connector modes:

- `mock`: only bundled demo data.
- `hybrid`: real Reddit, SoPilot-backed X/Twitter by default, and real Etsy only when `ETSY_API_KEY` exists.
- `real`: real Reddit, real X/Twitter, and real Etsy; missing keys fail fast.

X/Twitter defaults to SoPilot's public RSS feed at `https://sopilot.net/rss/hottweets`, then filters the returned hot tweets by keyword inside the backtest workflow. To use the official X API instead, set `TWITTER_SOURCE="x-api"` and configure `X_BEARER_TOKEN`; that path uses `GET https://api.x.com/2/tweets/search/recent` and is limited by the X API plan, rate limits, and recent-search lookback window.

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
