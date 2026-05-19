/**
 * Synthesis Agent：汇总 EvidenceBundle，生成增长报告与 Opportunity Card。
 * MVP 为规则合成；有 normalized+enrichment 时复用 opportunity-scorer 打分。
 */
import { scoreOpportunity } from "@/modules/scoring/opportunity-scorer";
import { getVerticalConfig } from "./config/verticals";
import type {
  AgentFinding,
  DeepSearchObservation,
  DeepSearchPlan,
  DeepSearchReport,
  Evidence,
  EvidenceBundle,
  OpportunityCard
} from "./types";

function priorityOf(score: number): OpportunityCard["priority"] {
  if (score >= 75) {
    return "high";
  }

  if (score >= 55) {
    return "medium";
  }

  return "low";
}

function buildOpportunityDraft(observation: DeepSearchObservation | undefined, bundle: EvidenceBundle) {
  if (observation?.normalized && observation?.enrichment) {
    return scoreOpportunity(observation.normalized, observation.enrichment);
  }

  return {
    title: bundle.opportunityCandidate,
    type: "seo-brief" as const,
    score: Math.round(bundle.confidence),
    confidence: Math.round(bundle.confidence),
    evidenceSummary: bundle.compressedSummary,
    sourceUrls: bundle.sources.flatMap((source) =>
      source.representativeEvidence.map((evidence) => evidence.url)
    ),
    recommendedAct: "Use the bundled evidence to brief the next growth experiment."
  };
}

function buildGrowthActions(plan: DeepSearchPlan, bundle: EvidenceBundle, finding?: AgentFinding) {
  const vertical = getVerticalConfig(plan.vertical);
  const candidate = bundle.opportunityCandidate;
  const actions = new Set<string>();

  if (vertical.id === "ai_tattoo_generator") {
    actions.add(`Create SEO page: ${candidate}`);
    actions.add(`Draft a short video around "${candidate}" with stencil preview`);
    actions.add(`Generate Pinterest board prompts for minimal tattoo ideas`);
  } else if (vertical.id === "cross_border_ecommerce") {
    actions.add(`Validate a listing concept inspired by ${candidate}`);
    actions.add(`Plan a TikTok comparison video for the trend ${candidate}`);
  } else if (vertical.id === "ai_saas") {
    actions.add(`Draft a comparison landing page for ${candidate}`);
    actions.add(`Schedule a demo video answering ${candidate}`);
  } else if (vertical.id === "content_seo") {
    actions.add(`Cluster keyword brief around ${candidate}`);
    actions.add(`Outline a long-form blog post that closes the search intent`);
  } else if (vertical.id === "community_kol") {
    actions.add(`Draft outreach hook referencing ${candidate}`);
    actions.add(`Match candidate creators against the evidence list`);
  }

  if (finding?.summary) {
    actions.add(`Brief content: ${finding.summary}`);
  }

  return Array.from(actions).slice(0, 4);
}

function evidenceFromBundles(bundles: EvidenceBundle[]): Evidence[] {
  return bundles.flatMap((bundle) =>
    bundle.sources.flatMap((source) => source.representativeEvidence)
  );
}

export type SynthesisInput = {
  plan: DeepSearchPlan;
  findings: AgentFinding[];
  bundles: EvidenceBundle[];
  observations: DeepSearchObservation[];
};

/** 输出 DEEPSEARCH.md 规定的报告结构（executive summary、机会卡、风险与下一步） */
export function synthesiseReport(input: SynthesisInput): DeepSearchReport {
  const { plan, findings, bundles, observations } = input;
  const opportunities: OpportunityCard[] = bundles
    .map((bundle) => {
      const finding = findings.find((entry) => entry.taskId === bundle.questionId);
      const observation = observations.find(
        (entry) => entry.questionId === bundle.questionId
      );
      const draft = buildOpportunityDraft(observation, bundle);
      const evidenceCount = bundle.sources.reduce(
        (sum, source) => sum + source.representativeEvidence.length,
        0
      );
      const score = Math.min(
        100,
        Math.round(
          draft.score * 0.6 + bundle.confidence * 0.4 + Math.min(20, bundle.sources.length * 5)
        )
      );
      const confidence = Math.min(
        95,
        Math.round((bundle.confidence + draft.confidence) / 2 + bundle.sources.length * 2)
      );
      const sourceUrls = Array.from(
        new Set(
          [
            ...bundle.sources.flatMap((source) =>
              source.representativeEvidence.map((evidence) => evidence.url)
            ),
            ...draft.sourceUrls
          ].filter(Boolean)
        )
      );

      return {
        id: `opp_${bundle.id}`,
        title: bundle.opportunityCandidate,
        whyNow:
          finding?.summary ??
          `${plan.vertical} signal suggests ${bundle.opportunityCandidate} is rising now.`,
        audience: plan.audience,
        evidenceCount,
        confidence,
        score,
        growthActions: buildGrowthActions(plan, bundle, finding),
        priority: priorityOf(score),
        evidenceBundleIds: [bundle.id],
        sourceUrls,
        draft: {
          ...draft,
          evidenceSummary: bundle.compressedSummary,
          sourceUrls
        }
      } satisfies OpportunityCard;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const evidenceTable = evidenceFromBundles(bundles);

  const trending = bundles
    .map((bundle) => bundle.opportunityCandidate)
    .slice(0, 5);

  const painPoints = Array.from(
    new Set(
      findings.flatMap((finding) =>
        finding.evidence.flatMap((evidence) =>
          evidence.snippet
            ? [evidence.snippet.split(/[.;\n]/)[0].slice(0, 120)]
            : []
        )
      )
    )
  ).slice(0, 6);

  const risks = [
    bundles.length < plan.questions.length
      ? "Some research questions returned no evidence; the report is partial."
      : null,
    plan.depth === "quick"
      ? "Quick scan only — recommend running standard or deep depth before acting."
      : null,
    // 部分数据源仍为 fixture，报告需人工核实后再对外发布
    "Pinterest, YouTube, TikTok and SEO data are still partly fixture-based; verify before publishing."
  ].filter((value): value is string => Boolean(value));

  return {
    runId: "",
    vertical: plan.vertical,
    depth: plan.depth,
    title: `DeepSearch report: ${plan.goal}`,
    executiveSummary: `Routed to ${plan.vertical} with ${plan.questions.length} research tasks. Generated ${bundles.length} evidence bundles, surfaced ${opportunities.length} opportunity cards, kept ${evidenceTable.length} evidence rows for audit.`,
    whatIsTrending: trending,
    userPainPoints: painPoints,
    evidenceTable,
    topOpportunities: opportunities,
    recommendedActions: opportunities.flatMap((opportunity) => opportunity.growthActions).slice(0, 6),
    risks,
    nextSearchSuggestions: plan.seedKeywords
      .flatMap((keyword) => [`${keyword} placement`, `${keyword} comparison`])
      .slice(0, 6),
    citations: evidenceTable
  };
}
