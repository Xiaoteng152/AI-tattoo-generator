/**
 * 按研究深度映射上下文预算（见 DEEPSEARCH.md L1–L4）。
 * Raw 与 evidence 上限防止 synthesis Prompt 膨胀；token 字段预留给后续 LLM 截断。
 */
import type { ContextBudget, DeepSearchDepth } from "../types";

const quickBudget: ContextBudget = {
  maxRawItemsPerAgent: 10,
  maxEvidencePerAgent: 5,
  maxPlannerTokens: 1200,
  maxSynthesisTokens: 6000,
  maxFinalReportTokens: 4000
};

const standardBudget: ContextBudget = {
  maxRawItemsPerAgent: 20,
  maxEvidencePerAgent: 10,
  maxPlannerTokens: 2000,
  maxSynthesisTokens: 12000,
  maxFinalReportTokens: 8000
};

const deepBudget: ContextBudget = {
  maxRawItemsPerAgent: 30,
  maxEvidencePerAgent: 14,
  maxPlannerTokens: 3000,
  maxSynthesisTokens: 18000,
  maxFinalReportTokens: 12000
};

const registry: Record<DeepSearchDepth, ContextBudget> = {
  quick: quickBudget,
  standard: standardBudget,
  deep: deepBudget
};

export function getContextBudget(depth: DeepSearchDepth): ContextBudget {
  return { ...registry[depth] };
}

export function getDefaultDepth(): DeepSearchDepth {
  return "standard";
}

export function listDepths(): DeepSearchDepth[] {
  return ["quick", "standard", "deep"];
}
