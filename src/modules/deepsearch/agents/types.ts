/**
 * Source Subagent 契约：每个子 Agent 消费 DeepSearchQuestion，返回 finding + 原始观测。
 * 与 Connector 层通过 connector-runner 桥接；未接 Connector 的数据源走 fixtures。
 */
import type {
  AgentFinding,
  AgentName,
  ContextBudget,
  DeepSearchObservation,
  DeepSearchQuestion,
  DeepSearchSource,
  DeepSearchSourceProgress,
  Evidence,
  VerticalId
} from "../types";

export type AgentContext = {
  runId: string;
  vertical: VerticalId;
  contextBudget: ContextBudget;
  lookbackDays: number;
  limitPerSource: number;
  abortSignal?: AbortSignal;
};

export type AgentTaskInput = {
  question: DeepSearchQuestion;
  context: AgentContext;
};

export type AgentTaskResult = {
  finding: AgentFinding;
  observations: DeepSearchObservation[];
  progress: DeepSearchSourceProgress[];
};

/** 数据源子 Agent：name 与 planner 分配的 agent 字段一致 */
export interface SourceSubagent {
  name: AgentName;
  supportedSources: DeepSearchSource[];
  run(input: AgentTaskInput): Promise<AgentTaskResult>;
}

export function makeEvidenceId(prefix: string, index: number) {
  return `${prefix}_${index}_${Math.random().toString(36).slice(2, 6)}`;
}

export function makeFindingId(runId: string, taskId: string, agent: AgentName) {
  return `finding_${runId}_${taskId}_${agent}`;
}

export function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function emptyFinding(
  agent: AgentName,
  runId: string,
  taskId: string,
  summary = "No evidence collected"
): AgentFinding {
  return {
    id: makeFindingId(runId, taskId, agent),
    runId,
    taskId,
    agent,
    summary,
    evidence: [],
    gaps: ["No evidence collected"],
    confidence: 0
  };
}

export function summarizeMetrics(metrics: Record<string, unknown>): string {
  const ordered: Array<[string, string]> = [];
  const formatNumber = (value: unknown) =>
    typeof value === "number"
      ? value >= 1000
        ? `${Math.round(value / 100) / 10}k`
        : `${value}`
      : null;
  const candidates = [
    ["upvotes", "upvotes"],
    ["comments", "comments"],
    ["favorites", "likes"],
    ["saves", "saves"],
    ["retweets", "reposts"],
    ["replies", "replies"],
    ["views", "views"],
    ["salesSignal", "sales signal"]
  ] as const;

  for (const [key, label] of candidates) {
    const formatted = formatNumber((metrics as Record<string, unknown>)[key]);

    if (formatted) {
      ordered.push([label, formatted]);
    }
  }

  if (!ordered.length) {
    return "no public metrics";
  }

  return ordered.map(([label, value]) => `${value} ${label}`).join(" / ");
}

/**
 * 将 L1 观测转为 L2 证据；置信度综合归一化互动分、标题信息密度与发布时间。
 */
export function toEvidenceFromObservation(
  observation: DeepSearchObservation,
  options: { runId: string; agent: AgentName; sourceType: DeepSearchSource; index: number }
): Evidence {
  const baseConfidence = observation.normalized
    ? Math.min(0.95, 0.4 + observation.normalized.engagementScore / 400)
    : 0.4;
  const matchedKeywordCount = (observation.rawItem.title.match(/\w+/g) ?? []).length;
  const recencyBoost = observation.rawItem.publishedAt
    ? Math.max(0, 0.1 - (Date.now() - new Date(observation.rawItem.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : 0;

  const confidence = clampConfidence(baseConfidence + Math.min(0.05, matchedKeywordCount / 200) + recencyBoost);

  return {
    id: makeEvidenceId(`ev_${options.runId}`, options.index),
    runId: options.runId,
    questionId: observation.questionId,
    agent: options.agent,
    sourceType: options.sourceType,
    title: observation.rawItem.title,
    url: observation.rawItem.sourceUrl,
    snippet:
      observation.rawItem.snippet ??
      observation.normalized?.body?.slice(0, 200) ??
      observation.rawItem.title,
    metrics: observation.rawItem.metrics,
    publishedAt: observation.rawItem.publishedAt,
    confidence
  };
}
