import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeTradingPosts, TradingAiNotConfiguredError } from "../trading-analyzer";

test("trading analysis never fabricates a fallback signal when AI is not configured", async () => {
  await assert.rejects(
    () =>
      analyzeTradingPosts({
        apiKey: "",
        strategy: "只在确认后入场",
        posts: [
          {
            id: "105",
            text: "BTC long after confirmation",
            sourceUrl: "https://x.com/a/status/105"
          }
        ]
      }),
    TradingAiNotConfiguredError
  );
});
