import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTelegramTradingMessage, shouldDeliverTradingDigest } from "../telegram-message";

test("Telegram pushes both matching and conflicting explicit signals once per digest", () => {
  const result = buildTelegramTradingMessage({
    digestId: "digest-1",
    summary: ["BTC 与 ETH 出现明确条件信号"],
    signals: [
      {
        asset: "BTC",
        direction: "LONG",
        entryPrice: "68,000",
        entryTiming: "4H 收盘确认后",
        invalidation: "未明确",
        strategyMatch: "MATCH",
        strategyReason: "等待确认后入场",
        sourcePostIds: ["105"],
        sourceUrls: ["https://x.com/a/status/105"]
      },
      {
        asset: "ETH",
        direction: "SHORT",
        entryPrice: "未明确",
        entryTiming: "反弹失败时",
        invalidation: "未明确",
        strategyMatch: "CONFLICT",
        strategyReason: "不符合只做多规则",
        sourcePostIds: ["104"],
        sourceUrls: ["https://x.com/b/status/104"]
      }
    ]
  });

  assert.equal(result?.idempotencyKey, "telegram:trading-digest:digest-1");
  assert.match(result?.text ?? "", /✅ 符合策略/);
  assert.match(result?.text ?? "", /⚠️ 与策略冲突/);
});

test("only a later automatic sync can deliver a trading digest", () => {
  assert.equal(shouldDeliverTradingDigest({ trigger: "sync", isInitialImport: false }), true);
  assert.equal(shouldDeliverTradingDigest({ trigger: "sync", isInitialImport: true }), false);
  assert.equal(shouldDeliverTradingDigest({ trigger: "manual", isInitialImport: false }), false);
});
