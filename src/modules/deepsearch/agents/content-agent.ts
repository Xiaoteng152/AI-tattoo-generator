/**
 * 内容子 Agent：YouTube/TikTok 选题与钩子；Twitter 可走 Connector，视频平台暂 fixture。
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

export const contentAgent: SourceSubagent = {
  name: "content_agent",
  supportedSources: ["youtube", "tiktok", "twitter"],
  async run({ question, context }: AgentTaskInput): Promise<AgentTaskResult> {
    const observations: DeepSearchObservation[] = [];
    const progress: DeepSearchSourceProgress[] = [];

    for (const source of question.sources) {
      if (isConnectorSource(source) && source === "twitter") {
        const result = await runConnectorForQuestion({
          question,
          source,
          agent: "content_agent",
          productDirection: question.question,
          limitPerSource: context.limitPerSource,
          lookbackDays: context.lookbackDays
        });

        observations.push(...result.observations);
        progress.push(result.progress);
        continue;
      }

      if (hasFixtureFor(source, "content_agent")) {
        const startedAt = Date.now();
        const fixtureObservations = getFixtureObservations({
          source,
          agent: "content_agent",
          question,
          limit: context.limitPerSource
        });
        observations.push(...fixtureObservations);
        progress.push({
          questionId: question.id,
          agent: "content_agent",
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
        agent: "content_agent",
        query: question.queries[0] ?? question.question,
        source,
        ok: false,
        itemCount: 0,
        durationMs: 0,
        error: `${source} is not wired into the content_agent yet.`
      });
    }

    if (!observations.length) {
      return {
        finding: emptyFinding(
          "content_agent",
          context.runId,
          question.id,
          progress[0]?.error ?? "Content agent collected no evidence."
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
          agent: "content_agent",
          sourceType: observation.source,
          index
        })
      );

    const confidence =
      evidence.reduce((sum, item) => sum + item.confidence, 0) / Math.max(evidence.length, 1);

    return {
      finding: {
        id: makeFindingId(context.runId, question.id, "content_agent"),
        runId: context.runId,
        taskId: question.id,
        agent: "content_agent",
        summary: `Captured ${observations.length} content angles across ${Array.from(
          new Set(observations.map((observation) => observation.source))
        ).join(", ")}.`,
        evidence,
        gaps:
          observations.length < 2
            ? ["Content angles are sparse; rerun with deeper depth."]
            : [],
        confidence
      },
      observations,
      progress
    };
  }
};
