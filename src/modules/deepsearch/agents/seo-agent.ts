/**
 * SEO 子 Agent：关键词簇与搜索意图；Connector 未实现前用 SERP fixture 保证可演示。
 */
import { getFixtureObservations } from "./fixtures";
import {
  emptyFinding,
  makeFindingId,
  toEvidenceFromObservation,
  type AgentTaskInput,
  type AgentTaskResult,
  type SourceSubagent
} from "./types";
import type { DeepSearchSourceProgress } from "../types";

export const seoAgent: SourceSubagent = {
  name: "seo_agent",
  supportedSources: ["seo", "google_trends"],
  async run({ question, context }: AgentTaskInput): Promise<AgentTaskResult> {
    const observations = getFixtureObservations({
      source: "seo",
      agent: "seo_agent",
      question,
      limit: context.limitPerSource
    });

    const progress: DeepSearchSourceProgress[] = [
      {
        questionId: question.id,
        agent: "seo_agent",
        query: question.queries[0] ?? question.question,
        source: "seo",
        ok: observations.length > 0,
        itemCount: observations.length,
        durationMs: 5,
        error: observations.length
          ? undefined
          : "SEO connector is not implemented yet; fixture returned no rows."
      }
    ];

    if (!observations.length) {
      return {
        finding: emptyFinding("seo_agent", context.runId, question.id, "No SEO evidence captured."),
        observations,
        progress
      };
    }

    const evidence = observations
      .slice(0, context.contextBudget.maxEvidencePerAgent)
      .map((observation, index) =>
        toEvidenceFromObservation(observation, {
          runId: context.runId,
          agent: "seo_agent",
          sourceType: "seo",
          index
        })
      );

    const confidence = Math.min(
      0.92,
      0.55 + observations.length * 0.05 + (observations.length >= 3 ? 0.1 : 0)
    );

    const summary = `SEO routing surfaced ${observations.length} keyword opportunities with clear intent. Top candidate: ${observations[0].rawItem.title}.`;

    return {
      finding: {
        id: makeFindingId(context.runId, question.id, "seo_agent"),
        runId: context.runId,
        taskId: question.id,
        agent: "seo_agent",
        summary,
        evidence,
        gaps:
          observations.length < 2
            ? ["Limited SEO coverage; consider broadening keyword fan-out."]
            : [],
        confidence
      },
      observations,
      progress
    };
  }
};
