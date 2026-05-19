/** 子 Agent 注册表：planner 按 AgentName 解析具体实现 */
import type { AgentName } from "../types";
import { contentAgent } from "./content-agent";
import { kolAgent } from "./kol-agent";
import { redditAgent } from "./reddit-agent";
import { seoAgent } from "./seo-agent";
import type { SourceSubagent } from "./types";
import { visualTrendAgent } from "./visual-trend-agent";

const registry: Record<AgentName, SourceSubagent> = {
  reddit_agent: redditAgent,
  visual_trend_agent: visualTrendAgent,
  seo_agent: seoAgent,
  content_agent: contentAgent,
  kol_agent: kolAgent
};

export function getSourceSubagent(agent: AgentName): SourceSubagent {
  return registry[agent];
}

export function listSourceSubagents(): SourceSubagent[] {
  return Object.values(registry);
}

export type { SourceSubagent } from "./types";
