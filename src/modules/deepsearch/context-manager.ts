/**
 * Context Manager：在 evidence 进入 synthesis 前按预算裁剪 L1/L2。
 * 按 agent 分组、按互动/置信度排序，丢弃部分 raw 与低优先级 evidence（原始数据仍可落库回看）。
 */
import type {
  AgentFinding,
  AgentName,
  ContextBudget,
  DeepSearchObservation,
  Evidence
} from "./types";

export type ContextPlan = {
  rawItemsByAgent: Record<string, DeepSearchObservation[]>;
  evidenceByAgent: Record<string, Evidence[]>;
  totalRawItems: number;
  totalEvidence: number;
  droppedRawItemCount: number;
  droppedEvidenceCount: number;
};

function engagementScore(observation: DeepSearchObservation) {
  return observation.normalized?.engagementScore ?? 0;
}

/** 应用 maxRawItemsPerAgent / maxEvidencePerAgent，返回裁剪统计 */
export function applyContextBudget(input: {
  budget: ContextBudget;
  observations: DeepSearchObservation[];
  findings: AgentFinding[];
}): ContextPlan {
  const rawItemsByAgent: Record<string, DeepSearchObservation[]> = {};
  const evidenceByAgent: Record<string, Evidence[]> = {};
  let droppedRawItemCount = 0;
  let droppedEvidenceCount = 0;

  const observationsByAgent = new Map<AgentName, DeepSearchObservation[]>();
  for (const observation of input.observations) {
    const list = observationsByAgent.get(observation.agent) ?? [];
    list.push(observation);
    observationsByAgent.set(observation.agent, list);
  }

  for (const [agent, observations] of observationsByAgent.entries()) {
    const ranked = [...observations].sort((a, b) => engagementScore(b) - engagementScore(a));
    const kept = ranked.slice(0, input.budget.maxRawItemsPerAgent);
    rawItemsByAgent[agent] = kept;
    droppedRawItemCount += observations.length - kept.length;
  }

  for (const finding of input.findings) {
    const ranked = [...finding.evidence].sort((a, b) => b.confidence - a.confidence);
    const kept = ranked.slice(0, input.budget.maxEvidencePerAgent);
    evidenceByAgent[finding.agent] = kept;
    droppedEvidenceCount += finding.evidence.length - kept.length;
  }

  return {
    rawItemsByAgent,
    evidenceByAgent,
    totalRawItems: Object.values(rawItemsByAgent).reduce((sum, items) => sum + items.length, 0),
    totalEvidence: Object.values(evidenceByAgent).reduce((sum, items) => sum + items.length, 0),
    droppedRawItemCount,
    droppedEvidenceCount
  };
}

export function reduceFindingsToBudget(
  findings: AgentFinding[],
  budget: ContextBudget
): AgentFinding[] {
  return findings.map((finding) => ({
    ...finding,
    evidence: [...finding.evidence]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, budget.maxEvidencePerAgent)
  }));
}
