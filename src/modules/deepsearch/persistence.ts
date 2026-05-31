/**
 * DeepSearch 持久化适配器：把一次内存 run 落库为 DeepSearchRun / Plan / Question /
 * EvidenceBundle / Report，并提供历史列表与详情查询。
 *
 * 设计原则：
 * - 纯映射函数（mapRunStatus / buildRunData ...）与 IO 分离，便于无 DB 单测。
 * - 持久化为最佳努力：DB 不可用时返回 null，绝不让 DeepSearch 主流程崩溃。
 * - EvidenceBundle 通过逻辑问题 id → DB 问题 id 的映射保留证据链。
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDatabaseReady } from "@/lib/db-health";
import type { DeepSearchResult } from "./types";

type DeepSearchRunStatusValue = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

/** 内存态多状态机映射到落库的四态枚举 */
export function mapRunStatus(
  status: DeepSearchResult["state"]["status"]
): DeepSearchRunStatusValue {
  if (status === "completed") {
    return "COMPLETED";
  }

  if (status === "failed") {
    return "FAILED";
  }

  if (status === "pending") {
    return "PENDING";
  }

  return "RUNNING";
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function buildRunData(
  query: string,
  result: DeepSearchResult
): Prisma.DeepSearchRunCreateInput {
  const { state, report } = result;

  return {
    status: mapRunStatus(state.status),
    query,
    vertical: state.vertical,
    depth: state.depth,
    goal: state.goal,
    audience: result.plan.audience,
    seedKeywords: result.plan.seedKeywords,
    currentStep: state.currentStep,
    questionsCompleted: state.questionsCompleted,
    questionsTotal: state.questionsTotal,
    rawItemCount: state.rawItemCount,
    evidenceCount: state.evidenceCount,
    findingCount: state.findingCount,
    evidenceBundleCount: state.evidenceBundleCount,
    opportunityCount: report.topOpportunities.length,
    summary: toJson({
      intent: result.understanding.intent,
      targetMarket: result.understanding.targetMarket,
      timeRange: result.understanding.timeRange,
      requiredSources: result.understanding.requiredSources
    }),
    error: state.error ?? null,
    startedAt: new Date(),
    completedAt:
      state.status === "completed" || state.status === "failed"
        ? new Date()
        : null
  };
}

export function buildReportData(
  result: DeepSearchResult
): Prisma.DeepSearchReportUncheckedCreateInput {
  const { report } = result;

  return {
    deepSearchRunId: "",
    title: report.title,
    summary: report.executiveSummary,
    whatIsTrending: report.whatIsTrending,
    userPainPoints: report.userPainPoints,
    topOpportunities: toJson(report.topOpportunities),
    recommendedActions: report.recommendedActions,
    risks: report.risks,
    nextSearchSuggestions: report.nextSearchSuggestions,
    citations: toJson(report.citations)
  };
}

export type PersistDeepSearchInput = {
  query: string;
  result: DeepSearchResult;
};

/**
 * 落库一次完整 DeepSearch run，返回 DB run id；DB 不可用或失败时返回 null。
 */
export async function persistDeepSearchResult(
  input: PersistDeepSearchInput,
  client: PrismaClient = prisma
): Promise<string | null> {
  if (!(await isDatabaseReady())) {
    console.warn("[deepsearch] skip persistence: database not ready");
    return null;
  }

  const { query, result } = input;

  try {
    return await client.$transaction(async (tx) => {
      const run = await tx.deepSearchRun.create({
        data: buildRunData(query, result)
      });

      const plan = await tx.deepSearchPlan.create({
        data: {
          deepSearchRunId: run.id,
          vertical: result.plan.vertical,
          depth: result.plan.depth,
          goal: result.plan.goal,
          audience: result.plan.audience,
          seedKeywords: result.plan.seedKeywords,
          expectedOutputs: result.plan.expectedOutputs,
          contextBudget: toJson(result.plan.contextBudget),
          promptVersion: result.plan.promptVersion
        }
      });

      // 逻辑问题 id（rq1...）→ DB 问题 id，供 evidence bundle 关联
      const questionIdMap = new Map<string, string>();

      for (const [position, question] of result.plan.questions.entries()) {
        const created = await tx.deepSearchQuestion.create({
          data: {
            planId: plan.id,
            question: question.question,
            intent: question.intent,
            agent: question.agent,
            sources: question.sources,
            queries: question.queries,
            position
          }
        });
        questionIdMap.set(question.id, created.id);
      }

      for (const bundle of result.evidenceBundles) {
        const questionDbId = questionIdMap.get(bundle.questionId);

        if (!questionDbId) {
          continue;
        }

        await tx.evidenceBundle.create({
          data: {
            deepSearchRunId: run.id,
            questionId: questionDbId,
            opportunityCandidate: bundle.opportunityCandidate,
            sources: toJson(bundle.sources),
            compressedSummary: bundle.compressedSummary,
            confidence: Math.round(bundle.confidence)
          }
        });
      }

      const reportData = buildReportData(result);
      await tx.deepSearchReport.create({
        data: { ...reportData, deepSearchRunId: run.id }
      });

      return run.id;
    });
  } catch (error) {
    // 持久化失败不应影响已经生成的报告
    console.warn(
      "[deepsearch] persistence failed:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function listDeepSearchRuns(
  limit = 10,
  client: PrismaClient = prisma
) {
  return client.deepSearchRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      query: true,
      vertical: true,
      depth: true,
      status: true,
      goal: true,
      questionsTotal: true,
      questionsCompleted: true,
      evidenceCount: true,
      evidenceBundleCount: true,
      opportunityCount: true,
      error: true,
      createdAt: true,
      completedAt: true
    }
  });
}

export async function getDeepSearchRunDetail(
  id: string,
  client: PrismaClient = prisma
) {
  return client.deepSearchRun.findUnique({
    where: { id },
    include: {
      plan: {
        include: {
          questions: {
            orderBy: { position: "asc" }
          }
        }
      },
      evidenceBundles: {
        orderBy: { confidence: "desc" }
      },
      report: true
    }
  });
}
