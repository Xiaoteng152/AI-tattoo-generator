/**
 * 垂类配置：每个 Vertical 定义默认数据源、种子词、研究问题模板与评分规则。
 * 第一版以 ai_tattoo_generator 为主，其余垂类复用同一报告模板便于扩展。
 */
import type {
  AgentName,
  ContextBudget,
  DeepSearchDepth,
  DeepSearchSource,
  ScoringRule,
  SearchQuestionTemplate,
  VerticalConfig,
  VerticalId
} from "../types";

// 通用增长信号：互动、证据覆盖、痛点对齐
const baseScoringRules: ScoringRule[] = [
  { id: "engagement", weight: 0.4, signal: "engagement" },
  { id: "evidence_coverage", weight: 0.3, signal: "source_coverage" },
  { id: "pain_alignment", weight: 0.3, signal: "pain_alignment" }
];

const visualScoringRules: ScoringRule[] = [
  { id: "saves_or_favorites", weight: 0.5, signal: "visual_engagement" },
  { id: "source_coverage", weight: 0.25, signal: "source_coverage" },
  { id: "trend_freshness", weight: 0.25, signal: "freshness" }
];

const seoScoringRules: ScoringRule[] = [
  { id: "search_intent", weight: 0.4, signal: "intent_clarity" },
  { id: "evidence_density", weight: 0.4, signal: "evidence_density" },
  { id: "competitive_gap", weight: 0.2, signal: "competition" }
];

/** MVP 主垂类：Reddit 痛点 + 视觉趋势 + SEO + 内容角度 */
const aiTattoo: VerticalConfig = {
  id: "ai_tattoo_generator",
  name: "AI tattoo generator",
  defaultSources: ["reddit", "etsy", "pinterest", "youtube", "seo"],
  seedKeywords: [
    "ai tattoo",
    "tattoo generator",
    "minimal tattoo",
    "fine line tattoo",
    "tattoo ideas",
    "custom tattoo design"
  ],
  searchQuestions: [
    {
      id: "rq1",
      question:
        "Users mention what pain points when looking for tattoo ideas or AI tattoo tools?",
      intent: "pain_point",
      agent: "reddit_agent",
      sourceTypes: ["reddit"]
    },
    {
      id: "rq2",
      question: "Which tattoo visual styles are gaining attention?",
      intent: "visual_trend",
      agent: "visual_trend_agent",
      sourceTypes: ["pinterest", "etsy"]
    },
    {
      id: "rq3",
      question:
        "Which SEO topics around AI tattoo generator have clear search intent?",
      intent: "seo",
      agent: "seo_agent",
      sourceTypes: ["seo"]
    },
    {
      id: "rq4",
      question:
        "What content angles could convert this trend into short videos or landing pages?",
      intent: "content",
      agent: "content_agent",
      sourceTypes: ["youtube", "tiktok"]
    }
  ],
  scoringRules: [...baseScoringRules, ...visualScoringRules],
  reportTemplate: "growth_report_v1",
  promptVersion: "deepsearch-v1"
};

const aiSaas: VerticalConfig = {
  id: "ai_saas",
  name: "AI SaaS",
  defaultSources: ["reddit", "youtube", "seo"],
  seedKeywords: ["ai workflow tool", "ai saas", "automation tool"],
  searchQuestions: [
    {
      id: "rq1",
      question: "What pain points appear around AI workflow tools?",
      intent: "pain_point",
      agent: "reddit_agent",
      sourceTypes: ["reddit"]
    },
    {
      id: "rq2",
      question: "Which comparison or alternative searches are growing?",
      intent: "seo",
      agent: "seo_agent",
      sourceTypes: ["seo"]
    },
    {
      id: "rq3",
      question: "What content angles drive demos on YouTube?",
      intent: "content",
      agent: "content_agent",
      sourceTypes: ["youtube"]
    }
  ],
  scoringRules: [...baseScoringRules, ...seoScoringRules],
  reportTemplate: "growth_report_v1",
  promptVersion: "deepsearch-v1"
};

const crossBorder: VerticalConfig = {
  id: "cross_border_ecommerce",
  name: "Cross-border e-commerce",
  defaultSources: ["etsy", "pinterest", "tiktok", "youtube"],
  seedKeywords: ["etsy bestseller", "trending product", "pinterest aesthetic"],
  searchQuestions: [
    {
      id: "rq1",
      question: "Which product styles are repeatedly favorited?",
      intent: "visual_trend",
      agent: "visual_trend_agent",
      sourceTypes: ["etsy", "pinterest"]
    },
    {
      id: "rq2",
      question: "Which short-video angles trigger purchase interest?",
      intent: "content",
      agent: "content_agent",
      sourceTypes: ["tiktok", "youtube"]
    }
  ],
  scoringRules: [...baseScoringRules, ...visualScoringRules],
  reportTemplate: "growth_report_v1",
  promptVersion: "deepsearch-v1"
};

const contentSeo: VerticalConfig = {
  id: "content_seo",
  name: "Content SEO",
  defaultSources: ["seo", "reddit", "youtube"],
  seedKeywords: ["how to", "best", "alternative", "buyer guide"],
  searchQuestions: [
    {
      id: "rq1",
      question: "Which keyword clusters have actionable intent?",
      intent: "seo",
      agent: "seo_agent",
      sourceTypes: ["seo"]
    },
    {
      id: "rq2",
      question: "Which Reddit pain points support new landing pages?",
      intent: "pain_point",
      agent: "reddit_agent",
      sourceTypes: ["reddit"]
    }
  ],
  scoringRules: [...baseScoringRules, ...seoScoringRules],
  reportTemplate: "growth_report_v1",
  promptVersion: "deepsearch-v1"
};

const communityKol: VerticalConfig = {
  id: "community_kol",
  name: "Community / KOL",
  defaultSources: ["reddit", "youtube", "tiktok", "twitter"],
  seedKeywords: ["creator", "community", "kol", "koc"],
  searchQuestions: [
    {
      id: "rq1",
      question: "Which creators or communities are pulling repeat engagement?",
      intent: "creator_outreach",
      agent: "kol_agent",
      sourceTypes: ["youtube", "tiktok", "twitter"]
    },
    {
      id: "rq2",
      question: "Which community threads can power outreach context?",
      intent: "pain_point",
      agent: "reddit_agent",
      sourceTypes: ["reddit"]
    }
  ],
  scoringRules: [...baseScoringRules],
  reportTemplate: "growth_report_v1",
  promptVersion: "deepsearch-v1"
};

const registry: Record<VerticalId, VerticalConfig> = {
  ai_tattoo_generator: aiTattoo,
  ai_saas: aiSaas,
  cross_border_ecommerce: crossBorder,
  content_seo: contentSeo,
  community_kol: communityKol
};

export function listVerticalConfigs(): VerticalConfig[] {
  return Object.values(registry);
}

export function getVerticalConfig(id: VerticalId): VerticalConfig {
  return registry[id];
}

export function getDefaultVerticalId(): VerticalId {
  return "ai_tattoo_generator";
}

export function getAllAgents(): AgentName[] {
  const agents = new Set<AgentName>();
  for (const vertical of listVerticalConfigs()) {
    for (const question of vertical.searchQuestions) {
      agents.add(question.agent);
    }
  }
  return Array.from(agents);
}

export function getQuestionTemplates(
  verticalId: VerticalId
): SearchQuestionTemplate[] {
  return registry[verticalId].searchQuestions;
}

export function getSourcesForVertical(
  verticalId: VerticalId
): DeepSearchSource[] {
  return registry[verticalId].defaultSources;
}

export type { ContextBudget, DeepSearchDepth };
