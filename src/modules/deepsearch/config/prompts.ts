/**
 * Prompt 模板注册表：与业务逻辑解耦，便于版本化与后续接 LLM。
 * MVP 阶段子 Agent 多为规则/fixture，模板主要约束未来 LLM 调用的输出 JSON 形状。
 */
import type { AgentName } from "../types";

export type PromptTemplate = {
  id: string;
  version: string;
  description: string;
  template: string;
};

const queryUnderstanding: PromptTemplate = {
  id: "query_understanding",
  version: "v1",
  description:
    "Classify the user growth query into intent, vertical, target market, time range, keywords and required sources.",
  template: [
    "You are a growth-research query understanding agent.",
    "Given the user query, output a JSON with: intent, vertical, targetMarket, timeRange, keywords, requiredSources.",
    "Allowed vertical ids: ai_tattoo_generator, ai_saas, cross_border_ecommerce, content_seo, community_kol.",
    "Allowed sources: reddit, etsy, pinterest, youtube, tiktok, twitter, seo, google_trends.",
    "User query: {{query}}"
  ].join("\n")
};

const planner: PromptTemplate = {
  id: "research_planner",
  version: "v1",
  description:
    "Decompose the user query and vertical into independent research tasks for downstream subagents.",
  template: [
    "You are a research planner for growth opportunity discovery.",
    "Vertical: {{vertical}}",
    "Seed keywords: {{seedKeywords}}",
    "Depth: {{depth}}",
    "Return a JSON array of research tasks. Each task has: id, question, agent, sourceTypes."
  ].join("\n")
};

const agentPrompts: Record<AgentName, PromptTemplate> = {
  reddit_agent: {
    id: "reddit_agent",
    version: "v1",
    description:
      "Reddit subagent that finds pain points, needs, complaints and questions for the growth query.",
    template: [
      "You are a Reddit research subagent.",
      "Task: {{question}}",
      "Search keywords: {{keywords}}",
      "Return AgentFinding JSON: summary, evidence[], gaps[], confidence.",
      "Each evidence must keep title, url, snippet, metrics and confidence."
    ].join("\n")
  },
  visual_trend_agent: {
    id: "visual_trend_agent",
    version: "v1",
    description:
      "Pinterest/Etsy subagent for visual style, product trend, keywords and save/sales signals.",
    template: [
      "You are a visual trend subagent for AI tattoo and visual e-commerce growth.",
      "Task: {{question}}",
      "Search keywords: {{keywords}}",
      "Return AgentFinding JSON with evidence URLs, save/like metrics and confidence."
    ].join("\n")
  },
  seo_agent: {
    id: "seo_agent",
    version: "v1",
    description:
      "SEO subagent that expands keywords, judges intent and proposes SEO page briefs.",
    template: [
      "You are an SEO research subagent.",
      "Task: {{question}}",
      "Expand keywords from: {{keywords}}",
      "Return AgentFinding JSON with keyword clusters, intent, snippet and confidence."
    ].join("\n")
  },
  content_agent: {
    id: "content_agent",
    version: "v1",
    description:
      "YouTube/TikTok subagent that surfaces content angles, hooks and comment demand.",
    template: [
      "You are a short-video content subagent.",
      "Task: {{question}}",
      "Search angles around: {{keywords}}",
      "Return AgentFinding JSON with hooks, comment demand and source URLs."
    ].join("\n")
  },
  kol_agent: {
    id: "kol_agent",
    version: "v1",
    description: "KOC/KOL subagent that surfaces creator candidates and outreach reasons.",
    template: [
      "You are a KOC/KOL subagent.",
      "Task: {{question}}",
      "Identify candidates relevant to: {{keywords}}",
      "Return AgentFinding JSON with creator URLs, engagement quality and outreach hook."
    ].join("\n")
  }
};

const synthesis: PromptTemplate = {
  id: "synthesis_agent",
  version: "v1",
  description:
    "Aggregate findings from subagents, merge duplicate evidence, produce growth report sections and opportunity cards.",
  template: [
    "You are the synthesis agent.",
    "Combine the per-agent findings into a growth report.",
    "Sections: Executive Summary, What is trending, User pain points, Evidence table, Growth opportunities, Recommended actions, Risks and uncertainty, Next search suggestions.",
    "Mark uncertainty when evidence is thin or contradictory."
  ].join("\n")
};

const opportunityCard: PromptTemplate = {
  id: "opportunity_card",
  version: "v1",
  description:
    "Turn a high-confidence claim cluster into a structured Opportunity Card with growth actions.",
  template: [
    "Produce an opportunity card with fields: title, whyNow, audience, evidenceCount, confidence, growthActions, priority.",
    "Use citations from supporting evidence URLs only."
  ].join("\n")
};

export type PromptRegistry = {
  queryUnderstanding: PromptTemplate;
  planner: PromptTemplate;
  agents: Record<AgentName, PromptTemplate>;
  synthesis: PromptTemplate;
  opportunityCard: PromptTemplate;
};

const registry: PromptRegistry = {
  queryUnderstanding,
  planner,
  agents: agentPrompts,
  synthesis,
  opportunityCard
};

export function getPromptRegistry(): PromptRegistry {
  return registry;
}

export function getAgentPrompt(agent: AgentName): PromptTemplate {
  return agentPrompts[agent];
}

export function getPromptVersion(): string {
  return "deepsearch-v1";
}
