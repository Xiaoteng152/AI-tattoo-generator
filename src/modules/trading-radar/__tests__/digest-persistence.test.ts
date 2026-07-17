import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEnabledCreatorFilter, summarizeCreatorSyncResults } from "../creator-sync";
import { buildTradingDigestRecord } from "../digest-service";

test("buildTradingDigestRecord saves strategy snapshot with version metadata", () => {
  const record = buildTradingDigestRecord({
    inputKey: "digest-key",
    creatorIds: ["creator-a"],
    rawItemIds: ["post-1"],
    digest: {
      summary: ["等待 BTC 突破确认"],
      signals: []
    },
    strategy: {
      id: "default",
      content: "只在趋势确认后入场",
      version: 3
    }
  });

  assert.equal(record.strategySnapshot, "只在趋势确认后入场");
  assert.equal(record.strategyVersion, 3);
  assert.equal(record.promptVersion, "trading-radar-v1");
});

test("buildTradingDigestRecord keeps a distinct input key when force re-analyzing", () => {
  const base = buildTradingDigestRecord({
    inputKey: "stable-key",
    creatorIds: ["creator-a"],
    rawItemIds: ["post-1"],
    digest: { summary: ["观点"], signals: [] },
    strategy: { id: "default", content: "规则 A", version: 1 }
  });
  const forced = buildTradingDigestRecord({
    inputKey: "stable-key:1700000000000",
    creatorIds: ["creator-a"],
    rawItemIds: ["post-1"],
    digest: { summary: ["观点"], signals: [] },
    strategy: { id: "default", content: "规则 B", version: 2 }
  });

  assert.notEqual(base.inputKey, forced.inputKey);
  assert.equal(forced.strategySnapshot, "规则 B");
});

test("buildEnabledCreatorFilter only selects enabled creators", () => {
  assert.deepEqual(buildEnabledCreatorFilter(), { enabled: true });
  assert.deepEqual(buildEnabledCreatorFilter(["a", "b"]), {
    enabled: true,
    id: { in: ["a", "b"] }
  });
});

test("summarizeCreatorSyncResults reports partial and complete failures", () => {
  const partial = summarizeCreatorSyncResults([
    { creatorId: "a", added: 1, initial: false, error: null, analysisError: null },
    { creatorId: "b", added: 0, initial: false, error: "X unavailable", analysisError: null }
  ]);
  const failed = summarizeCreatorSyncResults([
    { creatorId: "a", added: 1, initial: false, error: null, analysisError: "AI unavailable" }
  ]);

  assert.deepEqual(partial, { ok: false, status: "partial", total: 2, succeeded: 1, failed: 1 });
  assert.deepEqual(failed, { ok: false, status: "failed", total: 1, succeeded: 0, failed: 1 });
});

test("summarizeCreatorSyncResults treats an empty enabled-creator set as success", () => {
  assert.deepEqual(summarizeCreatorSyncResults([]), {
    ok: true,
    status: "success",
    total: 0,
    succeeded: 0,
    failed: 0
  });
});
