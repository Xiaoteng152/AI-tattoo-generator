import { strict as assert } from "node:assert";
import { test } from "node:test";
import { planResearch } from "../planner";
import { understandQuery } from "../query-understanding";

test("planResearch produces vertical-aware questions", () => {
  const understanding = understandQuery({
    query: "Find growth opportunities for AI tattoo generator"
  });
  const plan = planResearch({ understanding, request: { depth: "standard" } });

  assert.equal(plan.vertical, "ai_tattoo_generator");
  assert.ok(plan.questions.length >= 2);
  for (const question of plan.questions) {
    assert.ok(question.queries.length >= 2);
    assert.ok(question.sources.length >= 1);
  }
});

test("planResearch enforces context budget per depth", () => {
  const understanding = understandQuery({
    query: "Find growth opportunities for AI tattoo generator"
  });

  const quick = planResearch({ understanding, request: { depth: "quick" } });
  const standard = planResearch({ understanding, request: { depth: "standard" } });
  const deep = planResearch({ understanding, request: { depth: "deep" } });

  assert.ok(quick.questions.length <= standard.questions.length);
  assert.ok(standard.questions.length <= deep.questions.length);
  assert.ok(
    quick.contextBudget.maxRawItemsPerAgent <= standard.contextBudget.maxRawItemsPerAgent
  );
  assert.ok(
    standard.contextBudget.maxEvidencePerAgent <= deep.contextBudget.maxEvidencePerAgent
  );
});

test("planResearch keeps prompt version from configuration", () => {
  const understanding = understandQuery({ query: "AI tattoo trends" });
  const plan = planResearch({ understanding, request: {} });

  assert.match(plan.promptVersion, /^deepsearch/);
});
