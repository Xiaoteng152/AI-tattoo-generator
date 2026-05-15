import type { NormalizedRecord } from "@/modules/normalization/normalize";

export type EnrichmentResult = {
  model: string;
  promptVersion: string;
  painPoints: string[];
  intent: string;
  trendType: string;
  keywords: string[];
  contentAngles: string[];
  evidenceSummary: string;
  opportunityScore: number;
};

const keywordRules = [
  { match: "stencil", keyword: "stencil-ready tattoo", pain: "Needs artist-ready output" },
  { match: "coverup", keyword: "tattoo coverup design", pain: "Needs help transforming an existing tattoo" },
  { match: "placement", keyword: "tattoo placement preview", pain: "Needs confidence before booking" },
  { match: "fine line", keyword: "fine line tattoo generator", pain: "Worries about tattoo longevity" },
  { match: "minimal", keyword: "minimal tattoo ideas", pain: "Needs tasteful minimal concepts" }
];

function inferFallbackKeyword(item: NormalizedRecord) {
  const tag = item.tags.find((value) => !value.startsWith("real-") && !value.startsWith("r/") && value.length > 1);
  return tag ?? item.title.split(/\s+/).slice(0, 3).join(" ") ?? "growth opportunity";
}

export function enrichNormalizedItem(item: NormalizedRecord): EnrichmentResult {
  const text = `${item.title} ${item.body} ${item.tags.join(" ")}`.toLowerCase();
  const matched = keywordRules.filter((rule) => text.includes(rule.match));
  const fallbackKeyword = inferFallbackKeyword(item);
  const keywords = matched.length > 0 ? matched.map((rule) => rule.keyword) : [fallbackKeyword];
  const painPoints =
    matched.length > 0 ? matched.map((rule) => rule.pain) : ["Needs clearer evidence-to-action framing"];
  const commercialSignal = item.source === "etsy" ? 14 : 0;
  const opportunityScore = Math.min(100, Math.round(item.engagementScore / 12) + matched.length * 9 + commercialSignal);

  return {
    model: "rule-based-mvp",
    promptVersion: "mvp-v0",
    painPoints: Array.from(new Set(painPoints)),
    intent: item.source === "etsy" ? "commercial-validation" : "problem-discovery",
    trendType: item.tags.includes("coverup") ? "utility" : "style-and-planning",
    keywords: Array.from(new Set(keywords)),
    contentAngles: [
      `Show ${keywords[0]} examples with source-backed concerns`,
      `Turn the evidence into an operator-ready growth brief`
    ],
    evidenceSummary: `${item.source.toUpperCase()} signal: ${item.title}`,
    opportunityScore
  };
}
