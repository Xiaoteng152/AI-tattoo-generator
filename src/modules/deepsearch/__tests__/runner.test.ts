import { strict as assert } from "node:assert";
import { test } from "node:test";

process.env.CONNECTORS_MODE = "mock";
process.env.ENRICHMENT_MODE = "rules";

import { runDeepSearchAgent } from "../runner";

test("runDeepSearchAgent runs end-to-end for ai_tattoo_generator vertical", async () => {
  const result = await runDeepSearchAgent({
    query: "Find growth opportunities for AI tattoo generator around fine line tattoo ideas",
    depth: "standard",
    limitPerSource: 2
  });

  assert.equal(result.state.vertical, "ai_tattoo_generator");
  assert.equal(result.state.status, "completed");
  assert.ok(result.findings.length >= 1, "should produce at least one finding");
  assert.ok(result.evidenceBundles.length >= 1, "should produce at least one evidence bundle");
  assert.ok(
    result.report.topOpportunities.length >= 1,
    "should produce at least one opportunity card"
  );

  for (const opportunity of result.report.topOpportunities) {
    assert.ok(opportunity.sourceUrls.length >= 1, "every opportunity card keeps source URLs");
    assert.ok(opportunity.growthActions.length >= 1);
  }
});

test("runDeepSearchAgent respects manual vertical override", async () => {
  const result = await runDeepSearchAgent({
    query: "Anything",
    vertical: "ai_saas",
    depth: "quick",
    limitPerSource: 2
  });

  assert.equal(result.state.vertical, "ai_saas");
  assert.equal(result.understanding.vertical, "ai_saas");
});

test("runDeepSearchAgent records progress for every routed source", async () => {
  const result = await runDeepSearchAgent({
    query: "Reddit tattoo placement anxiety",
    vertical: "ai_tattoo_generator",
    depth: "quick",
    limitPerSource: 2
  });

  assert.ok(["completed", "failed"].includes(result.state.status));
  assert.ok(result.progress.length >= 1, "progress events should be recorded");
  assert.ok(result.findings.length >= 1, "findings (even empty) are returned per question");
});

test("runDeepSearchAgent keeps source URLs across every evidence bundle", async () => {
  const result = await runDeepSearchAgent({
    query: "Find growth opportunities for AI tattoo generator",
    depth: "standard",
    limitPerSource: 2
  });

  if (!result.evidenceBundles.length) {
    return;
  }

  for (const bundle of result.evidenceBundles) {
    const urls = bundle.sources.flatMap((source) =>
      source.representativeEvidence.map((evidence) => evidence.url)
    );
    assert.ok(urls.length >= 1, "each bundle keeps at least one URL");
    assert.ok(urls.every(Boolean), "every evidence keeps a URL");
  }
});
