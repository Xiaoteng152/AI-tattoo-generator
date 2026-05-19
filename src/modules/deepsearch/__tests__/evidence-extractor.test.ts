import { strict as assert } from "node:assert";
import { test } from "node:test";
import { extractEvidenceBundles } from "../evidence-extractor";
import type {
  AgentFinding,
  DeepSearchPlan,
  Evidence
} from "../types";

function makeEvidence(options: {
  id: string;
  url: string;
  confidence: number;
  sourceType?: Evidence["sourceType"];
}): Evidence {
  return {
    id: options.id,
    runId: "run",
    questionId: "q1",
    agent: "reddit_agent",
    sourceType: options.sourceType ?? "reddit",
    title: options.id,
    url: options.url,
    snippet: options.id,
    metrics: {},
    confidence: options.confidence
  };
}

const plan: DeepSearchPlan = {
  id: "plan",
  vertical: "ai_tattoo_generator",
  depth: "standard",
  goal: "goal",
  audience: "audience",
  seedKeywords: ["ai tattoo"],
  questions: [
    {
      id: "q1",
      question: "Users want what?",
      intent: "pain_point",
      agent: "reddit_agent",
      sources: ["reddit"],
      queries: ["ai tattoo"]
    }
  ],
  expectedOutputs: ["seo_brief"],
  contextBudget: {
    maxRawItemsPerAgent: 5,
    maxEvidencePerAgent: 5,
    maxPlannerTokens: 100,
    maxSynthesisTokens: 200,
    maxFinalReportTokens: 300
  },
  promptVersion: "v1"
};

test("extractEvidenceBundles dedupes by URL and keeps highest confidence", () => {
  const finding: AgentFinding = {
    id: "f1",
    runId: "run",
    taskId: "q1",
    agent: "reddit_agent",
    summary: "Reddit captures pain points",
    evidence: [
      // 同一 path、不同 query 应去重并保留更高 confidence
      makeEvidence({ id: "e1", url: "https://example.com/a?utm=1", confidence: 0.5 }),
      makeEvidence({ id: "e2", url: "https://example.com/a?utm=2", confidence: 0.8 }),
      makeEvidence({ id: "e3", url: "https://example.com/b", confidence: 0.6 })
    ],
    gaps: [],
    confidence: 0.7
  };

  const bundles = extractEvidenceBundles({ plan, findings: [finding] });

  assert.equal(bundles.length, 1);
  const bundle = bundles[0];
  const evidenceUrls = bundle.sources.flatMap((source) =>
    source.representativeEvidence.map((evidence) => evidence.url)
  );
  assert.equal(new Set(evidenceUrls.map((url) => url.split("?")[0])).size, 2);
  const highest = bundle.sources[0].representativeEvidence[0];
  assert.ok(highest.confidence >= 0.8);
});

test("extractEvidenceBundles groups by source type", () => {
  const finding: AgentFinding = {
    id: "f1",
    runId: "run",
    taskId: "q1",
    agent: "visual_trend_agent",
    summary: "Visual signals",
    evidence: [
      makeEvidence({ id: "e1", url: "https://etsy.com/a", confidence: 0.7, sourceType: "etsy" }),
      makeEvidence({
        id: "e2",
        url: "https://pinterest.com/a",
        confidence: 0.6,
        sourceType: "pinterest"
      })
    ],
    gaps: [],
    confidence: 0.65
  };

  const bundles = extractEvidenceBundles({ plan, findings: [finding] });
  assert.equal(bundles.length, 1);
  const sourceTypes = bundles[0].sources.map((source) => source.source);
  assert.ok(sourceTypes.includes("etsy"));
  assert.ok(sourceTypes.includes("pinterest"));
});

test("extractEvidenceBundles ignores questions without evidence", () => {
  const bundles = extractEvidenceBundles({ plan, findings: [] });
  assert.equal(bundles.length, 0);
});
