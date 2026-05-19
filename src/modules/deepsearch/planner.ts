/**
 * Research Planner：把垂类路由结果展开为可并发执行的 DeepSearchQuestion。
 * depth 控制问题数量与每题 query 展开数；queries 由种子词 × intent 修饰符生成。
 */
import { getContextBudget, getDefaultDepth } from "./config/context-budgets";
import { getPromptVersion } from "./config/prompts";
import { getDefaultVerticalId } from "./config/verticals";
import { routeVertical } from "./vertical-router";
import type {
  DeepSearchDepth,
  DeepSearchInput,
  DeepSearchOutputType,
  DeepSearchPlan,
  DeepSearchQuestion,
  QueryUnderstanding
} from "./types";

const queryModifiersByIntent: Record<string, string[]> = {
  pain_point: ["pain", "problem", "regret", "before tattoo", "placement"],
  visual_trend: ["style", "fine line", "minimal", "trend"],
  seo: ["ideas", "generator", "how to", "best", "alternative"],
  content: ["short video", "viral", "tutorial", "examples"],
  creator_outreach: ["creator", "artist", "designer", "studio"],
  commercial: ["bestseller", "pricing", "listing", "shopify"]
};

const audienceByVertical: Record<string, string> = {
  ai_tattoo_generator:
    "Overseas consumers exploring custom tattoo ideas before booking an artist",
  ai_saas: "Builders and operators evaluating AI workflow tools",
  cross_border_ecommerce: "Cross-border buyers and creators around visual products",
  content_seo: "SEO and content operators chasing AI-related demand",
  community_kol: "Community managers running KOC/KOL outreach"
};

const defaultExpectedOutputs: DeepSearchOutputType[] = [
  "seo_brief",
  "short_video",
  "pinterest_prompt",
  "kol_outreach",
  "markdown_report"
];

const depthMaxQuestions: Record<DeepSearchDepth, number> = {
  quick: 2,
  standard: 4,
  deep: 6
};

const depthQueriesPerQuestion: Record<DeepSearchDepth, number> = {
  quick: 2,
  standard: 3,
  deep: 5
};

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function expandQueries(
  seedKeywords: string[],
  modifiers: string[],
  limit: number
) {
  if (!seedKeywords.length) {
    return modifiers.slice(0, limit);
  }

  const expansions = seedKeywords.flatMap((keyword) =>
    modifiers.map((modifier) => `${keyword} ${modifier}`)
  );

  return Array.from(new Set([...seedKeywords, ...expansions])).slice(0, limit);
}

export type PlannerInput = {
  understanding: QueryUnderstanding;
  request: DeepSearchInput;
};

/** 生成完整研究计划（含 contextBudget），供 runner 调度子 Agent */
export function planResearch(input: PlannerInput): DeepSearchPlan {
  const depth = input.request.depth ?? getDefaultDepth();
  const maxQuestions = depthMaxQuestions[depth];
  const maxQueries = depthQueriesPerQuestion[depth];
  const route = routeVertical({
    understanding: input.understanding,
    manualVertical: input.request.vertical,
    manualSources: input.request.requiredSources
  });
  const seedKeywords = input.request.seedKeywords?.length
    ? input.request.seedKeywords
    : input.understanding.keywords.length
      ? input.understanding.keywords
      : route.vertical.seedKeywords;

  const questions: DeepSearchQuestion[] = route.questions
    .slice(0, maxQuestions)
    .map((template) => {
      const modifiers = queryModifiersByIntent[template.intent] ?? ["overview"];

      return {
        id: template.id,
        question: template.question,
        intent: template.intent,
        agent: template.agent,
        sources: template.sourceTypes.filter((source) =>
          route.sources.includes(source)
        ),
        queries: expandQueries(seedKeywords, modifiers, maxQueries)
      };
    })
    .map((question) =>
      question.sources.length
        ? question
        : {
            ...question,
            sources: route.vertical.defaultSources.slice(0, 2)
          }
    );

  return {
    id: makeId("plan"),
    vertical: route.vertical.id,
    depth,
    goal:
      input.request.goal ??
      `Find source-backed growth opportunities for ${route.vertical.name}`,
    audience:
      input.request.audience ??
      audienceByVertical[route.vertical.id] ??
      "Overseas growth operators",
    seedKeywords,
    questions,
    expectedOutputs: defaultExpectedOutputs,
    contextBudget: getContextBudget(depth),
    promptVersion: getPromptVersion()
  };
}

export function createDefaultDeepSearchPlan(
  request: DeepSearchInput = {}
): DeepSearchPlan {
  const understanding: QueryUnderstanding = {
    intent: "find_growth_opportunities",
    vertical: request.vertical ?? getDefaultVerticalId(),
    targetMarket: request.targetMarket ?? "US",
    timeRange: request.timeRange ?? "last_30_days",
    keywords: request.seedKeywords ?? [],
    requiredSources: request.requiredSources ?? [],
    rationale: "default plan"
  };

  return planResearch({ understanding, request });
}
