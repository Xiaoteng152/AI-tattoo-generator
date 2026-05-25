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
  // 交易垂类规则优先于 tattoo 规则，MVP demo 默认走 crypto trading。
  { match: "比特币", keyword: "bitcoin market sentiment", pain: "Investors comparing BTC allocation vs other assets" },
  { match: "bitcoin", keyword: "bitcoin trading signals", pain: "Needs clearer BTC trend and entry timing" },
  { match: "以太坊", keyword: "ethereum market sentiment", pain: "Investors tracking ETH narrative shifts" },
  { match: "ethereum", keyword: "ethereum trading signals", pain: "Needs clearer ETH trend and catalysts" },
  { match: "加密", keyword: "crypto trading tools", pain: "Needs actionable crypto market signals without manual chart work" },
  { match: "合约", keyword: "crypto futures trading", pain: "Needs risk-aware derivatives signal framing" },
  { match: "币圈", keyword: "crypto community trends", pain: "Needs to translate social chatter into tradeable context" },
  { match: "stencil", keyword: "stencil-ready tattoo", pain: "Needs artist-ready output" },
  { match: "coverup", keyword: "tattoo coverup design", pain: "Needs help transforming an existing tattoo" },
  { match: "placement", keyword: "tattoo placement preview", pain: "Needs confidence before booking" },
  { match: "fine line", keyword: "fine line tattoo generator", pain: "Worries about tattoo longevity" },
  { match: "minimal", keyword: "minimal tattoo ideas", pain: "Needs tasteful minimal concepts" }
];

function inferFallbackKeyword(item: NormalizedRecord) {
  const contentKeyword = item.tags.find(
    (value) => !value.startsWith("real-") && !value.startsWith("r/") && !value.startsWith("x-") && value.length > 1
  );
  return contentKeyword ?? item.title.split(/\s+/).slice(0, 6).join(" ") ?? "growth opportunity";
}

function findMatchedKeywords(text: string, tags: string[]) {
  const normalizedText = text.toLowerCase();
  // 排除 connector 元数据 tag，只保留用户关键词或正文可验证的 tag。
  return tags.filter(
    (tag) =>
      !tag.startsWith("real-") &&
      !tag.startsWith("x-") &&
      !tag.startsWith("sopilot-") &&
      normalizedText.includes(tag.toLowerCase())
  );
}

export function enrichNormalizedItem(item: NormalizedRecord): EnrichmentResult {
  const text = `${item.title} ${item.body}`.toLowerCase();
  const matched = keywordRules.filter((rule) => text.includes(rule.match));
  const matchedKeywords = findMatchedKeywords(`${item.title} ${item.body}`, item.tags);
  const fallbackKeyword = matchedKeywords[0] ?? inferFallbackKeyword(item);
  const keywords = matched.length > 0 ? matched.map((rule) => rule.keyword) : [fallbackKeyword];
  const painPoints =
    matched.length > 0
      ? matched.map((rule) => rule.pain)
      : matchedKeywords.length > 0
        ? [`Audience is discussing ${matchedKeywords.slice(0, 2).join(" / ")} in public channels`]
        : ["Needs clearer evidence-to-action framing"];
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
