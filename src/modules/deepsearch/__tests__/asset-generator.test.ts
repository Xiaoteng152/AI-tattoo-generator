import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  generateOpportunityAsset,
  getOutputTypeLabel,
  getOutputTypesForVertical
} from "../asset-generator";
import type { AssetGenerationContext, AssetOpportunity } from "../types";

const opportunity: AssetOpportunity = {
  id: "opp_demo_1",
  title: "Fine line AI tattoo preview workflow",
  whyNow:
    "Recent discussions show users want personalized tattoo ideas before appointments.",
  audience: "People planning first tattoos and fine line tattoo fans",
  score: 82,
  confidence: 78,
  priority: "high",
  evidenceCount: 6,
  growthActions: [
    "Create SEO page: AI fine line tattoo generator",
    "Publish short video: preview your tattoo before visiting an artist"
  ],
  sourceUrls: [
    "https://example.com/reddit/post",
    "https://example.com/pinterest/pin"
  ]
};

const context: AssetGenerationContext = {
  vertical: "ai_tattoo_generator",
  seedKeywords: ["ai tattoo", "fine line tattoo"],
  painPoints: ["Hard to preview a custom tattoo before booking an artist"],
  productDirection: "AI tattoo generator"
};

test("getOutputTypesForVertical returns vertical-specific asset types", () => {
  const tattoo = getOutputTypesForVertical("ai_tattoo_generator");
  assert.ok(tattoo.includes("seo_brief"));
  assert.ok(tattoo.includes("pinterest_prompt"));

  const kol = getOutputTypesForVertical("community_kol");
  assert.ok(kol.includes("kol_outreach"));
});

test("generateOpportunityAsset builds an SEO brief grounded in evidence URLs", () => {
  const asset = generateOpportunityAsset({
    opportunity,
    outputType: "seo_brief",
    context
  });

  assert.equal(asset.outputType, "seo_brief");
  assert.equal(asset.format, "markdown");
  assert.equal(asset.opportunityId, opportunity.id);
  assert.equal(asset.reviewGate, false);
  assert.ok(asset.content.startsWith("# SEO Brief:"));
  assert.ok(asset.content.includes(opportunity.title));
  for (const url of opportunity.sourceUrls) {
    assert.ok(asset.content.includes(url), `asset should cite ${url}`);
  }
});

test("generateOpportunityAsset uses each output template", () => {
  for (const outputType of [
    "short_video",
    "pinterest_prompt",
    "kol_outreach"
  ] as const) {
    const asset = generateOpportunityAsset({ opportunity, outputType, context });
    assert.ok(
      asset.title.startsWith(getOutputTypeLabel(outputType)),
      `title should label ${outputType}`
    );
    assert.ok(asset.content.length > 0);
    assert.deepEqual(asset.sourceUrls, opportunity.sourceUrls);
  }
});

test("kol_outreach asset keeps the review gate", () => {
  const asset = generateOpportunityAsset({
    opportunity,
    outputType: "kol_outreach",
    context
  });

  assert.equal(asset.reviewGate, true);
  assert.ok(asset.content.toLowerCase().includes("review gate"));
});

test("generateOpportunityAsset falls back to vertical keywords when none provided", () => {
  const asset = generateOpportunityAsset({
    opportunity: { ...opportunity, sourceUrls: [] },
    outputType: "seo_brief",
    context: { vertical: "ai_tattoo_generator" }
  });

  assert.ok(asset.content.includes("No source URLs"));
  assert.ok(asset.sourceUrls.length === 0);
});
