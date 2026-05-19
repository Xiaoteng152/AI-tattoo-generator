/**
 * 视觉/电商趋势子 Agent：Etsy 走 Connector，Pinterest 等 MVP 用 fixture 演示端到端。
 */
import { getFixtureObservations, hasFixtureFor } from "./fixtures";
import {
  isConnectorSource,
  runConnectorForQuestion
} from "./connector-runner";
import {
  emptyFinding,
  makeFindingId,
  toEvidenceFromObservation,
  type AgentTaskInput,
  type AgentTaskResult,
  type SourceSubagent
} from "./types";
import type { DeepSearchObservation, DeepSearchSourceProgress } from "../types";

function summarize(observations: DeepSearchObservation[]) {
  if (!observations.length) {
    return "No visual or commercial trend evidence captured.";
  }

  const sources = Array.from(new Set(observations.map((observation) => observation.source))).join(" + ");
  return `${observations.length} signals from ${sources} suggest the visual/commercial direction is active.`;
}

export const visualTrendAgent: SourceSubagent = {
  name: "visual_trend_agent",
  supportedSources: ["pinterest", "etsy"],
  async run({ question, context }: AgentTaskInput): Promise<AgentTaskResult> {
    const observations: DeepSearchObservation[] = [];
    const progress: DeepSearchSourceProgress[] = [];

    for (const source of question.sources) {
      if (isConnectorSource(source) && source === "etsy") {
        const result = await runConnectorForQuestion({
          question,
          source,
          agent: "visual_trend_agent",
          productDirection: question.question,
          limitPerSource: context.limitPerSource,
          lookbackDays: context.lookbackDays
        });

        observations.push(...result.observations);
        progress.push(result.progress);
        continue;
      }

      if (hasFixtureFor(source, "visual_trend_agent")) {
        const startedAt = Date.now();
        const fixtureObservations = getFixtureObservations({
          source,
          agent: "visual_trend_agent",
          question,
          limit: context.limitPerSource
        });
        observations.push(...fixtureObservations);
        progress.push({
          questionId: question.id,
          agent: "visual_trend_agent",
          query: question.queries[0] ?? question.question,
          source,
          ok: true,
          itemCount: fixtureObservations.length,
          durationMs: Date.now() - startedAt
        });
        continue;
      }

      progress.push({
        questionId: question.id,
        agent: "visual_trend_agent",
        query: question.queries[0] ?? question.question,
        source,
        ok: false,
        itemCount: 0,
        durationMs: 0,
        error: `${source} is not supported by the visual_trend_agent fixture or connector yet.`
      });
    }

    if (!observations.length) {
      return {
        finding: emptyFinding(
          "visual_trend_agent",
          context.runId,
          question.id,
          progress[0]?.error ?? "No visual evidence available."
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
          agent: "visual_trend_agent",
          sourceType: observation.source,
          index
        })
      );
    const confidence =
      evidence.reduce((sum, item) => sum + item.confidence, 0) / Math.max(evidence.length, 1);

    return {
      finding: {
        id: makeFindingId(context.runId, question.id, "visual_trend_agent"),
        runId: context.runId,
        taskId: question.id,
        agent: "visual_trend_agent",
        summary: summarize(observations),
        evidence,
        gaps:
          observations.length < 3
            ? ["Visual evidence is thin; expand keyword variants or sources."]
            : [],
        confidence
      },
      observations,
      progress
    };
  }
};
