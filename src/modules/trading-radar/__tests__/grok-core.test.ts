import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertGrokBearer,
  assertGrokSignature,
  GrokAuthError,
  parseGrokTimestamp,
  signGrokBody
} from "../grok-auth";
import { computeSearchWindow, getQuotaWindow, nextScheduledRunAt } from "../grok-quota";
import { validateGrokFindings } from "../grok-findings";
import { parseXStatusUrl } from "../grok-status-url";

const SECRET = "0123456789abcdef0123456789abcdef";

test("assertGrokBearer accepts matching secret", () => {
  process.env.GROK_INGEST_SECRET = SECRET;
  const request = new Request("http://localhost/api", {
    headers: { authorization: `Bearer ${SECRET}` }
  });
  assert.doesNotThrow(() => assertGrokBearer(request));
});

test("assertGrokBearer rejects wrong secret", () => {
  process.env.GROK_INGEST_SECRET = SECRET;
  const request = new Request("http://localhost/api", {
    headers: { authorization: "Bearer 0123456789abcdef0123456789abcdee" }
  });
  assert.throws(() => assertGrokBearer(request), GrokAuthError);
});

test("HMAC signature verifies timestamp + body", () => {
  process.env.GROK_INGEST_SECRET = SECRET;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ run: { id: "run-1" } });
  const signature = signGrokBody(SECRET, timestamp, body);
  const request = new Request("http://localhost/api", {
    headers: { "x-grok-signature": `sha256=${signature}` }
  });
  assert.doesNotThrow(() => assertGrokSignature(request, body, timestamp));
});

test("parseGrokTimestamp rejects stale timestamps", () => {
  assert.throws(() => parseGrokTimestamp(String(Date.now() - 10 * 60 * 1000)), GrokAuthError);
});

test("getQuotaWindow rolls by 7 days from anchor", () => {
  process.env.GROK_WEEKLY_RESET_ANCHOR = "2026-07-29T03:25:00Z";
  const window = getQuotaWindow(new Date("2026-08-01T10:00:00Z"));
  assert.equal(window.start.toISOString(), "2026-07-29T03:25:00.000Z");
  assert.equal(window.end.toISOString(), "2026-08-05T03:25:00.000Z");
});

test("computeSearchWindow overlaps previous success by 6 hours", () => {
  const now = new Date("2026-07-22T00:30:00Z");
  const last = new Date("2026-07-18T00:30:00Z");
  const window = computeSearchWindow({ now, lastSucceededUntil: last });
  assert.equal(window.since.toISOString(), "2026-07-17T18:30:00.000Z");
  assert.equal(window.until.toISOString(), now.toISOString());
});

test("nextScheduledRunAt returns next Tue/Fri 00:30 UTC", () => {
  const next = nextScheduledRunAt(new Date("2026-07-21T12:00:00Z")); // Tuesday
  assert.ok(next);
  assert.equal(next.toISOString(), "2026-07-24T00:30:00.000Z");
});

test("parseXStatusUrl accepts x.com and twitter.com", () => {
  const parsed = parseXStatusUrl("https://twitter.com/KillaXBT/status/2079586556814164073");
  assert.ok(parsed);
  assert.equal(parsed.statusId, "2079586556814164073");
  assert.equal(parsed.canonicalUrl, "https://x.com/KillaXBT/status/2079586556814164073");
});

test("validateGrokFindings rejects mismatched evidence and keeps valid rows", () => {
  const since = new Date("2026-07-18T00:00:00Z");
  const until = new Date("2026-07-22T00:00:00Z");
  const result = validateGrokFindings({
    accounts: ["KillaXBT"],
    window: { since, until },
    findings: [
      {
        creatorHandle: "KillaXBT",
        url: "https://x.com/KillaXBT/status/2079586556814164073",
        sourceText: "buy BTC below the 50D MA on the monthly",
        publishedAt: "2026-07-21T15:17:26Z",
        symbols: ["BTC"],
        direction: "LONG",
        entryTiming: "月线低于 50D MA 时",
        entryTimingEvidence: "buy BTC below the 50D MA on the monthly",
        entryPrice: "虚构价格",
        entryPriceEvidence: "not-in-text",
        invalidation: "未明确",
        strategyMatch: "UNKNOWN",
        strategyReason: "原文没有完整失效条件"
      },
      {
        creatorHandle: "outsider",
        url: "https://x.com/outsider/status/1",
        sourceText: "hello",
        publishedAt: "2026-07-21T15:17:26Z"
      }
    ]
  });

  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].entryTiming, "月线低于 50D MA 时");
  assert.equal(result.accepted[0].entryPrice, "未明确");
  assert.ok(result.rejected.some((item) => item.reason === "creator_not_allowed"));
});
