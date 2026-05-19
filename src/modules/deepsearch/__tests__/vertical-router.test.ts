import { strict as assert } from "node:assert";
import { test } from "node:test";
import { understandQuery } from "../query-understanding";
import { routeVertical } from "../vertical-router";

test("routeVertical selects ai_tattoo_generator agents for the tattoo query", () => {
  const understanding = understandQuery({
    query: "Find growth opportunities for AI tattoo generator"
  });
  const route = routeVertical({ understanding });

  assert.equal(route.vertical.id, "ai_tattoo_generator");
  assert.ok(route.agents.includes("reddit_agent"));
  assert.ok(route.agents.includes("visual_trend_agent"));
});

test("routeVertical respects manual vertical override", () => {
  const understanding = understandQuery({
    query: "How do users compare AI workflow tools?"
  });
  const route = routeVertical({
    understanding,
    manualVertical: "community_kol"
  });

  assert.equal(route.vertical.id, "community_kol");
  assert.ok(route.agents.includes("kol_agent"));
});

test("routeVertical filters questions to the requested source set", () => {
  const understanding = understandQuery({
    query: "Find tattoo SEO opportunities"
  });
  const route = routeVertical({
    understanding,
    manualSources: ["reddit"]
  });

  for (const question of route.questions) {
    assert.ok(
      question.sourceTypes.some((source) => route.sources.includes(source)),
      `question ${question.id} should match the source set`
    );
  }
});
