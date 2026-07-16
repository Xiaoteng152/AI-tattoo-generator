import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeTradingDigest } from "../trading-digest";

test("unsupported entry details are removed instead of becoming trading advice", () => {
  const digest = normalizeTradingDigest(
    {
      summary: ["博主等待 BTC 突破确认"],
      signals: [
        {
          asset: "BTC",
          direction: "LONG",
          entryPrice: "67,200",
          entryPriceEvidence: "Buy at 67,200",
          entryTiming: "4H 收盘站上 68,000 后",
          entryTimingEvidence: "after the 4H close above 68000",
          invalidation: "未明确",
          invalidationEvidence: "",
          strategyMatch: "MATCH",
          strategyReason: "等待确认",
          sourcePostIds: ["105"]
        }
      ]
    },
    [
      {
        id: "105",
        text: "BTC long after the 4H close above 68000",
        sourceUrl: "https://x.com/killaxbt/status/105"
      }
    ]
  );

  assert.equal(digest.signals[0].entryPrice, "未明确");
  assert.equal(digest.signals[0].entryTiming, "4H 收盘站上 68,000 后");
});

test("digest stays within the concise three-by-forty product limit", () => {
  const post = {
    id: "105",
    text: "BTC long after confirmation",
    sourceUrl: "https://x.com/killaxbt/status/105"
  };
  const signal = {
    asset: "BTC",
    direction: "WATCH",
    entryPrice: "未明确",
    entryTiming: "未明确",
    invalidation: "未明确",
    strategyMatch: "UNKNOWN",
    strategyReason: "等待更多信息",
    sourcePostIds: ["105"]
  };
  const digest = normalizeTradingDigest(
    {
      summary: ["一".repeat(60), "第二条", "第三条", "不应出现的第四条"],
      signals: [signal, signal, signal, signal]
    },
    [post]
  );

  assert.equal(digest.summary.length, 3);
  assert.equal(Array.from(digest.summary[0]).length, 40);
  assert.equal(digest.signals.length, 3);
});
