import { strict as assert } from "node:assert";
import { test } from "node:test";
import { understandQuery } from "../query-understanding";

test("understandQuery detects ai_tattoo_generator from English query", () => {
  const result = understandQuery({
    query: "Find growth opportunities for AI tattoo generator around fine line tattoo ideas"
  });

  assert.equal(result.vertical, "ai_tattoo_generator");
  assert.ok(result.keywords.length >= 3);
  assert.ok(result.requiredSources.includes("reddit"));
});

test("understandQuery detects ai_saas vertical", () => {
  const result = understandQuery({
    query: "Find growth opportunities around AI workflow tools in the US"
  });

  assert.equal(result.vertical, "ai_saas");
  assert.equal(result.targetMarket, "US");
});

test("understandQuery honours manual vertical override", () => {
  const result = understandQuery({
    query: "Reddit users complaining about long signup flows",
    manualVertical: "content_seo"
  });

  assert.equal(result.vertical, "content_seo");
  assert.match(result.rationale, /manual/);
});

test("understandQuery picks up mentioned data sources", () => {
  const result = understandQuery({
    query: "Use Reddit and Pinterest to find ai tattoo opportunities"
  });

  assert.equal(result.vertical, "ai_tattoo_generator");
  assert.ok(result.requiredSources.includes("reddit"));
  assert.ok(result.requiredSources.includes("pinterest"));
});

test("understandQuery returns last_30_days as default time range", () => {
  const result = understandQuery({
    query: "Find growth opportunities for ai tattoo generator"
  });

  assert.equal(result.timeRange, "last_30_days");
});

test("understandQuery detects last_7_days when 'this week' is present", () => {
  const result = understandQuery({
    query: "ai tattoo trends this week"
  });

  assert.equal(result.timeRange, "last_7_days");
});
