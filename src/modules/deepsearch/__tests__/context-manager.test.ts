import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyContextBudget, reduceFindingsToBudget } from "../context-manager";
import type {
  AgentFinding,
  ContextBudget,
  DeepSearchObservation,
  Evidence
} from "../types";

const budget: ContextBudget = {
  maxRawItemsPerAgent: 2,
  maxEvidencePerAgent: 2,
  maxPlannerTokens: 100,
  maxSynthesisTokens: 200,
  maxFinalReportTokens: 300
};

function makeObservation(id: string, score: number): DeepSearchObservation {
  return {
    questionId: "q1",
    agent: "reddit_agent",
    query: "tattoo",
    source: "reddit",
    rawItem: {
      externalId: id,
      sourceUrl: `https://example.com/${id}`,
      title: `Title ${id}`,
      metrics: {}
    },
    normalized: {
      source: "reddit",
      title: id,
      body: id,
      sourceUrl: `https://example.com/${id}`,
      tags: [],
      language: "en",
      engagementScore: score
    }
  };
}

function makeEvidence(id: string, confidence: number): Evidence {
  return {
    id,
    runId: "run",
    questionId: "q1",
    agent: "reddit_agent",
    sourceType: "reddit",
    title: id,
    url: `https://example.com/${id}`,
    snippet: id,
    metrics: {},
    confidence
  };
}

test("applyContextBudget keeps top observations per agent", () => {
  const observations = [
    makeObservation("a", 10),
    makeObservation("b", 50),
    makeObservation("c", 100),
    makeObservation("d", 25)
  ];

  const finding: AgentFinding = {
    id: "f1",
    runId: "run",
    taskId: "q1",
    agent: "reddit_agent",
    summary: "summary",
    evidence: [
      makeEvidence("e1", 0.2),
      makeEvidence("e2", 0.8),
      makeEvidence("e3", 0.6),
      makeEvidence("e4", 0.9)
    ],
    gaps: [],
    confidence: 0.7
  };

  const plan = applyContextBudget({
    budget,
    observations,
    findings: [finding]
  });

  assert.equal(plan.totalRawItems, 2);
  assert.deepEqual(
    plan.rawItemsByAgent["reddit_agent"].map((observation) => observation.rawItem.externalId),
    ["c", "b"]
  );
  assert.equal(plan.totalEvidence, 2);
  assert.deepEqual(
    plan.evidenceByAgent["reddit_agent"].map((evidence) => evidence.id),
    ["e4", "e2"]
  );
  assert.equal(plan.droppedRawItemCount, 2);
  assert.equal(plan.droppedEvidenceCount, 2);
});

test("reduceFindingsToBudget trims evidence in-place per finding", () => {
  const finding: AgentFinding = {
    id: "f1",
    runId: "run",
    taskId: "q1",
    agent: "reddit_agent",
    summary: "summary",
    evidence: [makeEvidence("e1", 0.4), makeEvidence("e2", 0.9), makeEvidence("e3", 0.7)],
    gaps: [],
    confidence: 0.8
  };

  const trimmed = reduceFindingsToBudget([finding], { ...budget, maxEvidencePerAgent: 1 });
  assert.equal(trimmed[0].evidence.length, 1);
  assert.equal(trimmed[0].evidence[0].id, "e2");
});
