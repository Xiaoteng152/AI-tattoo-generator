import assert from "node:assert/strict";
import { test } from "node:test";
import { buildXSearchQuery, findMatchedKeywords, keywordMatchesText } from "../twitter";

test("findMatchedKeywords only returns keywords present in post content", () => {
  const matched = findMatchedKeywords("AI tattoo fans ask about fine line tattoo placement previews", [
    "ai tattoo",
    "fine line tattoo",
    "bitcoin"
  ]);

  assert.deepEqual(matched, ["ai tattoo", "fine line tattoo"]);
});

test("keywordMatchesText ignores short tickers embedded in usernames", () => {
  assert.equal(keywordMatchesText("Grok is better than other AI tools", "ETH"), false);
  assert.equal(keywordMatchesText("Today BTC breaks resistance at 68k", "BTC"), true);
  assert.equal(keywordMatchesText("今天X的时间线上已经没有人在纠结比特币还是贵金属了", "比特币"), true);
});

test("findMatchedKeywords does not match handle-only crypto tickers", () => {
  const matched = findMatchedKeywords("Grok比起其他ai最大的优势", ["BTC", "ETH", "比特币"]);

  assert.deepEqual(matched, []);
});

test("buildXSearchQuery combines workflow keywords into an X recent-search query", () => {
  const query = buildXSearchQuery({
    productDirection: "AI tattoo generator",
    keywords: ["ai tattoo", "fine line tattoo"]
  });

  assert.match(query, /ai tattoo/);
  assert.match(query, /"fine line tattoo"/);
  assert.match(query, /-is:retweet/);
  assert.match(query, /lang:en/);
});

test("buildXSearchQuery skips lang:en when keywords include Chinese", () => {
  const query = buildXSearchQuery({
    productDirection: "Crypto trading signals",
    keywords: ["比特币", "ethereum"]
  });

  assert.match(query, /比特币/);
  assert.match(query, /ethereum/);
  assert.doesNotMatch(query, /lang:en/);
});
