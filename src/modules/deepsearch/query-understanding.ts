/**
 * Query Understanding：从自然语言问题推断垂类、市场、时间范围与数据源。
 * MVP 为规则引擎（非 LLM）；manualVertical/manualSources 可覆盖自动检测。
 */
import { getVerticalConfig, listVerticalConfigs } from "./config/verticals";
import type {
  DeepSearchSource,
  QueryUnderstanding,
  VerticalConfig,
  VerticalId
} from "./types";

type VerticalKeywordMap = {
  vertical: VerticalId;
  keywords: string[];
};

const verticalKeywords: VerticalKeywordMap[] = [
  {
    vertical: "ai_tattoo_generator",
    keywords: ["tattoo", "ink", "纹身", "刺青", "tatuagem"]
  },
  {
    vertical: "ai_saas",
    keywords: ["saas", "ai workflow", "ai tool", "automation tool", "agent"]
  },
  {
    vertical: "cross_border_ecommerce",
    keywords: [
      "etsy",
      "shopify",
      "amazon",
      "dropshipping",
      "跨境",
      "ecommerce",
      "e-commerce"
    ]
  },
  {
    vertical: "content_seo",
    keywords: ["seo", "keyword", "content marketing", "landing page", "blog"]
  },
  {
    vertical: "community_kol",
    keywords: ["kol", "koc", "creator", "influencer", "community"]
  }
];

function detectVertical(query: string): VerticalId {
  const haystack = query.toLowerCase();

  for (const entry of verticalKeywords) {
    if (entry.keywords.some((keyword) => haystack.includes(keyword))) {
      return entry.vertical;
    }
  }

  return "ai_tattoo_generator";
}

function detectTimeRange(query: string): QueryUnderstanding["timeRange"] {
  const haystack = query.toLowerCase();

  if (/last\s+7|past\s+7|this\s+week|本周|最近一周|近七天|近7/.test(haystack)) {
    return "last_7_days";
  }

  if (
    /last\s+(30|month)|past\s+30|this\s+month|本月|最近一个月|近30|近三十/.test(
      haystack
    )
  ) {
    return "last_30_days";
  }

  if (/last\s+(90|quarter)|past\s+90|近三个月|近90/.test(haystack)) {
    return "last_90_days";
  }

  return "last_30_days";
}

function detectTargetMarket(query: string): string {
  const haystack = query.toLowerCase();
  const markets: Array<{ pattern: RegExp; market: string }> = [
    { pattern: /\bus\b|usa|united states|美国/, market: "US" },
    { pattern: /europe|eu|uk|britain|英国|欧洲/, market: "EU" },
    { pattern: /japan|jp|日本/, market: "JP" },
    { pattern: /\bsea\b|southeast asia|东南亚/, market: "SEA" },
    { pattern: /中国|china|cn/, market: "CN" }
  ];

  for (const entry of markets) {
    if (entry.pattern.test(haystack)) {
      return entry.market;
    }
  }

  return "US";
}

function tokenizeKeywords(query: string, vertical: VerticalConfig): string[] {
  const stopwords = new Set([
    "find",
    "growth",
    "opportunities",
    "around",
    "for",
    "about",
    "and",
    "the",
    "in",
    "on",
    "of",
    "with"
  ]);
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s\u4e00-\u9fff]/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));

  const phraseTokens = tokens.slice(0, 6);
  const merged = Array.from(new Set([...phraseTokens, ...vertical.seedKeywords]));
  return merged.slice(0, 8);
}

function detectRequiredSources(
  query: string,
  vertical: VerticalConfig
): DeepSearchSource[] {
  const haystack = query.toLowerCase();
  const mentioned: DeepSearchSource[] = [];
  const sourceTokens: Array<{ source: DeepSearchSource; pattern: RegExp }> = [
    { source: "reddit", pattern: /reddit/ },
    { source: "etsy", pattern: /etsy/ },
    { source: "pinterest", pattern: /pinterest/ },
    { source: "youtube", pattern: /youtube/ },
    { source: "tiktok", pattern: /tiktok/ },
    { source: "twitter", pattern: /twitter|\bx\.com|\b@/ },
    { source: "seo", pattern: /seo|google|serp/ }
  ];

  for (const entry of sourceTokens) {
    if (entry.pattern.test(haystack)) {
      mentioned.push(entry.source);
    }
  }

  if (mentioned.length) {
    return Array.from(new Set([...mentioned, ...vertical.defaultSources]));
  }

  return vertical.defaultSources;
}

export type UnderstandQueryInput = {
  query: string;
  manualVertical?: VerticalId;
  manualSources?: DeepSearchSource[];
};

/** 解析用户 query，产出下游 Vertical Router / Planner 所需的结构化理解 */
export function understandQuery(input: UnderstandQueryInput): QueryUnderstanding {
  const query = input.query.trim();
  const detectedVertical = input.manualVertical ?? detectVertical(query);
  const verticalConfig = getVerticalConfig(detectedVertical);
  const keywords = tokenizeKeywords(query, verticalConfig);
  const requiredSources =
    input.manualSources?.length
      ? Array.from(new Set([...input.manualSources, ...verticalConfig.defaultSources]))
      : detectRequiredSources(query, verticalConfig);

  return {
    intent: "find_growth_opportunities",
    vertical: detectedVertical,
    targetMarket: detectTargetMarket(query),
    timeRange: detectTimeRange(query),
    keywords,
    requiredSources,
    rationale: input.manualVertical
      ? `Vertical manually set to ${detectedVertical}.`
      : `Detected vertical "${detectedVertical}" based on query tokens.`
  };
}

export function listKnownVerticals() {
  return listVerticalConfigs().map((vertical) => ({
    id: vertical.id,
    name: vertical.name,
    seedKeywords: vertical.seedKeywords
  }));
}
