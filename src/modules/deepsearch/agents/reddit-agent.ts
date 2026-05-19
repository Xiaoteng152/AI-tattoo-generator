/**
 * Reddit 子 Agent：痛点、需求、抱怨与真实表达；走 Connector，预算内裁剪为 evidence。
 */
import {
  emptyFinding,
  makeFindingId,
  toEvidenceFromObservation,
  type AgentTaskInput,
  type AgentTaskResult,
  type SourceSubagent
} from "./types";
import {
  isConnectorSource,
  runConnectorForQuestion
} from "./connector-runner";
import type { DeepSearchObservation } from "../types";

function summarizeRedditFinding(observations: DeepSearchObservation[]) {
  if (!observations.length) {
    return "No Reddit signal found within the budget.";
  }

  const painPoints = Array.from(
    new Set(
      observations.flatMap((observation) =>
        observation.enrichment?.painPoints?.slice(0, 2) ?? []
      )
    )
  ).slice(0, 3);

  const headline = observations[0].rawItem.title;
  return [
    `Reddit captured ${observations.length} relevant threads.`,
    painPoints.length ? `Top concerns: ${painPoints.join("; ")}.` : null,
    `Strongest thread: ${headline}.`
  ]
    .filter(Boolean)
    .join(" ");
}

function detectGaps(observations: DeepSearchObservation[]) {
  const gaps: string[] = [];

  if (observations.length < 3) {
    gaps.push("Sample size on Reddit is small; consider widening keywords.");
  }

  if (
    observations.every(
      (observation) => (observation.rawItem.metrics?.comments ?? 0) < 5
    )
  ) {
    gaps.push("Low comment depth; the discussion thread may be shallow.");
  }

  return gaps;
}

export const redditAgent: SourceSubagent = {
  name: "reddit_agent",
  supportedSources: ["reddit"],
  async run({ question, context }: AgentTaskInput): Promise<AgentTaskResult> {
    const findingId = makeFindingId(context.runId, question.id, "reddit_agent");
    const observations: DeepSearchObservation[] = [];
    const progress = [] as AgentTaskResult["progress"];

    const sources = question.sources.filter(isConnectorSource).filter((source) => source === "reddit");

    if (!sources.length) {
      return {
        finding: emptyFinding(
          "reddit_agent",
          context.runId,
          question.id,
          "Reddit was not part of the routed sources for this question."
        ),
        observations: [],
        progress: []
      };
    }

    for (const source of sources) {
      const { observations: connectorObservations, progress: connectorProgress } =
        await runConnectorForQuestion({
          question,
          source,
          agent: "reddit_agent",
          productDirection: question.question,
          limitPerSource: context.limitPerSource,
          lookbackDays: context.lookbackDays
        });

      observations.push(...connectorObservations);
      progress.push(connectorProgress);
    }

    if (!observations.length) {
      return {
        finding: emptyFinding(
          "reddit_agent",
          context.runId,
          question.id,
          progress[0]?.error ?? "Reddit returned no results."
        ),
        observations,
        progress
      };
    }

    const evidence = observations
      .slice(0, context.contextBudget.maxEvidencePerAgent)
      .map((observation, index) =>
        toEvidenceFromObservation(observation, {
          runId: context.runId,
          agent: "reddit_agent",
          sourceType: "reddit",
          index
        })
      );

    const confidence =
      evidence.length === 0
        ? 0
        : evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length;

    return {
      finding: {
        id: findingId,
        runId: context.runId,
        taskId: question.id,
        agent: "reddit_agent",
        summary: summarizeRedditFinding(observations),
        evidence,
        gaps: detectGaps(observations),
        confidence
      },
      observations,
      progress
    };
  }
};
