/**
 * KOC/KOL 子 Agent：创作者候选与触达理由；MVP 全 fixture，触达需人工审核（见 gaps）。
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

export const kolAgent: SourceSubagent = {
  name: "kol_agent",
  supportedSources: ["youtube", "tiktok", "twitter"],
  async run({ question, context }: AgentTaskInput): Promise<AgentTaskResult> {
    const startedAt = Date.now();
    const source = question.sources[0] ?? "youtube";
    const observations = getFixtureObservations({
      source,
      agent: "kol_agent",
      question,
      limit: context.limitPerSource
    });

    const progress: DeepSearchSourceProgress[] = [
      {
        questionId: question.id,
        agent: "kol_agent",
        query: question.queries[0] ?? question.question,
        source,
        ok: observations.length > 0,
        itemCount: observations.length,
        durationMs: Date.now() - startedAt,
        error: observations.length
          ? undefined
          : "KOC/KOL connectors are not implemented yet; fixture returned no rows."
      }
    ];

    if (!observations.length) {
      return {
        finding: emptyFinding("kol_agent", context.runId, question.id, "No KOL evidence captured."),
        observations,
        progress
      };
    }

    const evidence = observations
      .slice(0, context.contextBudget.maxEvidencePerAgent)
      .map((observation, index) =>
        toEvidenceFromObservation(observation, {
          runId: context.runId,
          agent: "kol_agent",
          sourceType: observation.source,
          index
        })
      );

    const confidence = Math.min(0.9, 0.5 + observations.length * 0.1);

    return {
      finding: {
        id: makeFindingId(context.runId, question.id, "kol_agent"),
        runId: context.runId,
        taskId: question.id,
        agent: "kol_agent",
        summary: `Identified ${observations.length} potential creators with audience overlap.`,
        evidence,
        // 触达话术必须经运营审核，禁止自动发送
        gaps: ["Outreach drafts must stay behind the review gate; no auto-send."],
        confidence
      },
      observations,
      progress
    };
  }
};
