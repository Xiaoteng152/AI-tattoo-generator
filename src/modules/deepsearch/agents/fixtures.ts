/**
 * 未接真实 Connector 的数据源用确定性 fixture，保证 DeepSearch 端到端可跑、可测。
 * 关键词匹配失败时回退全量 fixture，避免空跑导致 synthesis 无 bundle。
 */
import type {
  DeepSearchObservation,
  DeepSearchQuestion,
  DeepSearchSource,
  AgentName
} from "../types";

type FixtureItem = {
  externalId: string;
  sourceUrl: string;
  title: string;
  snippet: string;
  publishedAt?: string;
  metrics: Record<string, number>;
};

const pinterestFixtures: FixtureItem[] = [
  {
    externalId: "pinterest-fine-line-collage-001",
    sourceUrl: "https://www.pinterest.com/pin/mock_fine_line_collage",
    title: "Fine line minimalist tattoo inspirations",
    snippet:
      "Pinned collection of fine line, single needle, and micro symbol tattoos with stencil annotations.",
    metrics: { saves: 3120, favorites: 2410 }
  },
  {
    externalId: "pinterest-floral-coverup-002",
    sourceUrl: "https://www.pinterest.com/pin/mock_floral_coverup",
    title: "Floral coverup ideas for old script tattoos",
    snippet:
      "Trend board curating peony, wildflower and abstract floral coverup mockups.",
    metrics: { saves: 1860, favorites: 1340 }
  },
  {
    externalId: "pinterest-placement-mockups-003",
    sourceUrl: "https://www.pinterest.com/pin/mock_placement_mockups",
    title: "Placement mockups: wrist, collarbone, ankle previews",
    snippet:
      "Visualizations of common minimal tattoo placements with photo overlays for client briefings.",
    metrics: { saves: 1430, favorites: 980 }
  }
];

const seoFixtures: FixtureItem[] = [
  {
    externalId: "serp-ai-tattoo-generator-001",
    sourceUrl: "https://serp.example.com/ai-tattoo-generator",
    title: "ai tattoo generator (~30k monthly searches, transactional intent)",
    snippet:
      "Search intent: users want a tool to preview AI-generated tattoo designs. Top SERP is dominated by free generator tools and Reddit threads.",
    metrics: { volume: 30000, difficulty: 38, intent_score: 82 }
  },
  {
    externalId: "serp-fine-line-tattoo-ideas-002",
    sourceUrl: "https://serp.example.com/fine-line-tattoo-ideas",
    title: "fine line tattoo ideas (~22k monthly, informational + commercial)",
    snippet:
      "Search intent: idea browsing before booking. SERP mixes Pinterest, blogs and Reddit; opportunity for a curated brief.",
    metrics: { volume: 22000, difficulty: 31, intent_score: 78 }
  },
  {
    externalId: "serp-custom-tattoo-design-003",
    sourceUrl: "https://serp.example.com/custom-tattoo-design",
    title: "custom tattoo design (~14k monthly, commercial)",
    snippet:
      "Search intent: looking for paid custom designs and AI-assisted artist briefs.",
    metrics: { volume: 14000, difficulty: 42, intent_score: 88 }
  }
];

const youtubeFixtures: FixtureItem[] = [
  {
    externalId: "youtube-ai-tattoo-walkthrough-001",
    sourceUrl: "https://www.youtube.com/watch?v=mock_ai_tattoo_walkthrough",
    title: "I tested 5 AI tattoo generators before my next appointment",
    snippet:
      "Creator compares AI tattoo generators with side-by-side flash previews and a stencil-ready output.",
    metrics: { views: 184000, likes: 5800, comments: 612 }
  },
  {
    externalId: "youtube-finelines-comparison-002",
    sourceUrl: "https://www.youtube.com/watch?v=mock_fine_line_compare",
    title: "Fine line vs micro tattoo: which AI prompts work best?",
    snippet:
      "Walks through prompt engineering for fine-line tattoo previews and shares 3 working hooks.",
    metrics: { views: 98000, likes: 3100, comments: 290 }
  }
];

const tiktokFixtures: FixtureItem[] = [
  {
    externalId: "tiktok-ai-tattoo-trend-001",
    sourceUrl: "https://www.tiktok.com/@studio/video/mock_ai_tattoo_trend",
    title: "AI tattoo preview trend hits 4M plays",
    snippet:
      "Creator overlays AI tattoo previews on real bodies; comment section asks for stencil files.",
    metrics: { views: 4200000, likes: 312000, comments: 9100 }
  }
];

const kolFixtures: FixtureItem[] = [
  {
    externalId: "kol-finelink-studio-001",
    sourceUrl: "https://www.instagram.com/finelink_studio",
    title: "FineLink Studio (fine-line tattoo studio, 88k IG followers)",
    snippet:
      "Studio openly posts client briefs and revision flow. Strong fit for AI brief tooling partnership.",
    metrics: { followers: 88000, engagement_rate: 5.2 }
  },
  {
    externalId: "kol-ink-creator-002",
    sourceUrl: "https://www.youtube.com/@ink_creator",
    title: "Ink Creator (tattoo planning channel, 210k subs)",
    snippet:
      "Hosts the 'before you book' series; audience overlap with AI tattoo idea seekers.",
    metrics: { subscribers: 210000, engagement_rate: 4.1 }
  }
];

const fixtureBySource: Record<DeepSearchSource, FixtureItem[] | undefined> = {
  reddit: undefined,
  etsy: undefined,
  twitter: undefined,
  pinterest: pinterestFixtures,
  youtube: youtubeFixtures,
  tiktok: tiktokFixtures,
  seo: seoFixtures,
  google_trends: seoFixtures
};

const fixtureByAgentForKol: FixtureItem[] = kolFixtures;

function matchKeywords(item: FixtureItem, queries: string[]) {
  if (!queries.length) {
    return true;
  }

  const haystack = `${item.title} ${item.snippet}`.toLowerCase();
  return queries.some((query) => haystack.includes(query.toLowerCase().split(" ")[0]));
}

export function getFixtureObservations(options: {
  source: DeepSearchSource;
  agent: AgentName;
  question: DeepSearchQuestion;
  limit: number;
}): DeepSearchObservation[] {
  const fixtures = options.agent === "kol_agent"
    ? fixtureByAgentForKol
    : (fixtureBySource[options.source] ?? []);

  const filtered = fixtures.filter((item) => matchKeywords(item, options.question.queries));
  const selected = (filtered.length ? filtered : fixtures).slice(0, options.limit);
  const query = options.question.queries[0] ?? options.question.question;

  return selected.map((item) => ({
    questionId: options.question.id,
    agent: options.agent,
    query,
    source: options.source,
    rawItem: {
      externalId: item.externalId,
      sourceUrl: item.sourceUrl,
      title: item.title,
      snippet: item.snippet,
      publishedAt: item.publishedAt,
      metrics: item.metrics
    }
  }));
}

export function hasFixtureFor(source: DeepSearchSource, agent: AgentName) {
  if (agent === "kol_agent") {
    return fixtureByAgentForKol.length > 0;
  }

  return Boolean(fixtureBySource[source]?.length);
}
