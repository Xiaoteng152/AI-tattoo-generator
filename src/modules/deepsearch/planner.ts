import type { DeepSearchInput, DeepSearchPlan, DeepSearchQuestion } from "./types";

const defaultKeywords = ["ai tattoo", "tattoo generator", "minimal tattoo", "fine line tattoo", "custom tattoo design"];

function makeId(prefix: string, index?: number) {
  return `${prefix}_${index ?? Math.random().toString(36).slice(2, 8)}`;
}

function expandQueries(seedKeywords: string[], modifiers: string[]) {
  return seedKeywords.flatMap((keyword) => modifiers.map((modifier) => `${keyword} ${modifier}`)).slice(0, 5);
}

export function createDefaultDeepSearchPlan(input: DeepSearchInput = {}): DeepSearchPlan {
  const goal = input.goal ?? "Find source-backed growth opportunities for AI tattoo generator";
  const audience = input.audience ?? "overseas consumers exploring custom tattoo ideas before booking an artist";
  const seedKeywords = input.seedKeywords?.length ? input.seedKeywords : defaultKeywords;
  const questions: DeepSearchQuestion[] = [
    {
      id: makeId("q", 1),
      question: "用户为什么想用 AI tattoo generator？",
      intent: "pain_point",
      sources: ["reddit"],
      queries: expandQueries(seedKeywords, ["why use", "problem", "before tattoo"])
    },
    {
      id: makeId("q", 2),
      question: "用户在纹身设计前最担心什么？",
      intent: "pain_point",
      sources: ["reddit"],
      queries: expandQueries(seedKeywords, ["placement", "regret", "stencil"])
    },
    {
      id: makeId("q", 3),
      question: "哪些 tattoo 风格正在反复出现？",
      intent: "visual_trend",
      sources: ["reddit", "etsy"],
      queries: expandQueries(seedKeywords, ["style", "fine line", "minimal"])
    },
    {
      id: makeId("q", 4),
      question: "哪些关键词有 SEO 页面机会？",
      intent: "seo",
      sources: ["reddit", "etsy"],
      queries: expandQueries(seedKeywords, ["ideas", "generator", "design"])
    },
    {
      id: makeId("q", 5),
      question: "哪些短视频内容角度可能传播？",
      intent: "content",
      sources: ["twitter", "reddit"],
      queries: expandQueries(seedKeywords, ["trend", "viral", "examples"])
    },
    {
      id: makeId("q", 6),
      question: "哪些纹身师、设计师或内容创作者适合 KOC/KOL 触达？",
      intent: "creator_outreach",
      sources: ["twitter", "etsy"],
      queries: expandQueries(seedKeywords, ["artist", "creator", "designer"])
    }
  ];

  return {
    id: makeId("plan"),
    goal,
    audience,
    seedKeywords,
    questions,
    expectedOutputs: ["seo_brief", "short_video", "pinterest_prompt", "kol_outreach"]
  };
}
