import assert from "node:assert/strict";
import { test } from "node:test";
import { runScheduledSync } from "../src/index";

const env = {
  TRADING_RADAR_SYNC_URL: "https://example.com/api/trading-radar/sync",
  CRON_SECRET: "secret"
};

test("scheduled sync accepts an explicitly successful API result", async () => {
  await runScheduledSync(env, async () =>
    Response.json({ ok: true, status: "success", total: 1, succeeded: 1, failed: 0 })
  );
});

test("scheduled sync rejects partial failures even when the API returns HTTP 200", async () => {
  await assert.rejects(
    runScheduledSync(env, async () =>
      Response.json({ ok: false, status: "partial", total: 2, succeeded: 1, failed: 1 })
    ),
    /partial.*1 failed/i
  );
});

test("scheduled sync rejects a successful HTTP response without a valid result envelope", async () => {
  await assert.rejects(runScheduledSync(env, async () => new Response("ok")), /invalid sync API response/i);
});
