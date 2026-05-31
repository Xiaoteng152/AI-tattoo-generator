import { strict as assert } from "node:assert";
import { test } from "node:test";

process.env.CONNECTORS_MODE = "mock";
process.env.ENRICHMENT_MODE = "rules";

import { buildReportData, buildRunData, mapRunStatus } from "../persistence";
import { runDeepSearchAgent } from "../runner";

test("mapRunStatus maps the in-memory state machine to the persisted enum", () => {
  assert.equal(mapRunStatus("completed"), "COMPLETED");
  assert.equal(mapRunStatus("failed"), "FAILED");
  assert.equal(mapRunStatus("pending"), "PENDING");
  assert.equal(mapRunStatus("planning"), "RUNNING");
  assert.equal(mapRunStatus("searching"), "RUNNING");
  assert.equal(mapRunStatus("analyzing"), "RUNNING");
  assert.equal(mapRunStatus("reporting"), "RUNNING");
});

test("buildRunData captures query, vertical, depth and counts from the result", async () => {
  const query = "Find growth opportunities for AI tattoo generator";
  const result = await runDeepSearchAgent({ query, depth: "standard", limitPerSource: 2 });
  const data = buildRunData(query, result);

  assert.equal(data.query, query);
  assert.equal(data.vertical, "ai_tattoo_generator");
  assert.equal(data.depth, "standard");
  assert.equal(data.status, "COMPLETED");
  assert.equal(data.questionsTotal, result.plan.questions.length);
  assert.equal(data.opportunityCount, result.report.topOpportunities.length);
  assert.ok(Array.isArray(data.seedKeywords));
});

test("buildReportData keeps trending, pain points and citations", async () => {
  const query = "AI tattoo generator fine line ideas";
  const result = await runDeepSearchAgent({ query, depth: "standard", limitPerSource: 2 });
  const data = buildReportData(result);

  assert.equal(data.title, result.report.title);
  assert.equal(data.summary, result.report.executiveSummary);
  assert.deepEqual(data.whatIsTrending, result.report.whatIsTrending);
  assert.deepEqual(data.userPainPoints, result.report.userPainPoints);
  assert.deepEqual(data.recommendedActions, result.report.recommendedActions);
  assert.ok(Array.isArray(data.risks));
});
