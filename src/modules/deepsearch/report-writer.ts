import { scoreOpportunity } from "@/modules/scoring/opportunity-scorer";
import type { DeepSearchObservation, DeepSearchPlan, DeepSearchReport, EvidenceBundle } from "./types";

function sourceCoverage(bundle: EvidenceBundle) {
  return bundle.sources.length;
}

function recommendedActionsForBundle(bundle: EvidenceBundle) {
  const evidenceUrls = bundle.sources.flatMap((source) => source.representativeEvidence.map((evidence) => evidence.url));

  return [
    `Turn "${bundle.opportunityCandidate}" into an SEO brief with ${evidenceUrls.length} cited evidence URLs.`,
    "Create a short-video angle that starts from the strongest user concern, then shows AI tattoo examples.",
    "Prepare a Pinterest prompt and outreach note only after the evidence bundle is reviewed."
  ];
}

function draftFromBundle(bundle: EvidenceBundle, observations: DeepSearchObservation[]) {
  const firstObservation = observations.find((observation) => observation.questionId === bundle.questionId);

  if (!firstObservation) {
    return {
      title: bundle.opportunityCandidate,
      type: "seo-brief" as const,
      score: Math.min(100, 55 + sourceCoverage(bundle) * 10),
      confidence: bundle.confidence,
      evidenceSummary: bundle.compressedSummary,
      sourceUrls: bundle.sources.flatMap((source) => source.representativeEvidence.map((evidence) => evidence.url)),
      recommendedAct: recommendedActionsForBundle(bundle)[0]
    };
  }

  return scoreOpportunity(firstObservation.normalized, firstObservation.enrichment);
}

export function writeDeepSearchReport(
  runId: string,
  plan: DeepSearchPlan,
  bundles: EvidenceBundle[],
  observations: DeepSearchObservation[]
): DeepSearchReport {
  const opportunities = bundles
    .map((bundle) => {
      const draft = draftFromBundle(bundle, observations);
      const evidenceUrls = bundle.sources.flatMap((source) => source.representativeEvidence.map((evidence) => evidence.url));
      const sourceBoost = sourceCoverage(bundle) * 5;

      return {
        title: `${bundle.opportunityCandidate}: ${plan.questions.find((question) => question.id === bundle.questionId)?.question ?? plan.goal}`,
        score: Math.min(100, draft.score + sourceBoost),
        confidence: Math.min(95, Math.max(draft.confidence, bundle.confidence)),
        evidenceBundleIds: [bundle.id],
        recommendedActions: recommendedActionsForBundle(bundle),
        sourceUrls: Array.from(new Set([...draft.sourceUrls, ...evidenceUrls])),
        draft: {
          ...draft,
          evidenceSummary: bundle.compressedSummary,
          sourceUrls: Array.from(new Set([...draft.sourceUrls, ...evidenceUrls]))
        }
      };
    })
    .filter((opportunity) => opportunity.sourceUrls.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return {
    runId,
    title: `DeepSearch report: ${plan.goal}`,
    summary: `Generated ${bundles.length} evidence bundles from ${observations.length} observations across ${new Set(
      observations.map((observation) => observation.source)
    ).size} sources. Every opportunity keeps source URLs for review.`,
    topOpportunities: opportunities,
    risks: [
      "Pinterest and Google Trends routing is planned but not enabled in this first implementation.",
      "SoPilot-backed X/Twitter data is useful for hot-post monitoring, but should be treated as a derived source.",
      "Rule-based planning is deterministic; LLM planner calibration is a later step."
    ],
    nextSearchSuggestions: plan.seedKeywords.flatMap((keyword) => [`${keyword} placement anxiety`, `${keyword} stencil examples`]).slice(0, 6)
  };
}
