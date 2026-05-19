/**
 * DeepSearch 编排入口：串联 understand → plan → subagents → context → extract → synthesise。
 * 状态机：planning → searching → analyzing → reporting → completed|failed。
 */
import { getSourceSubagent } from "./agents/registry";
import type {
  AgentContext,
  AgentTaskResult
} from "./agents/types";
import { applyContextBudget, reduceFindingsToBudget } from "./context-manager";
import { extractEvidenceBundles } from "./evidence-extractor";
import { planResearch } from "./planner";
import { understandQuery } from "./query-understanding";
import { synthesiseReport } from "./synthesis";
import type {
  AgentFinding,
  DeepSearchInput,
  DeepSearchObservation,
  DeepSearchResult,
  DeepSearchRunState,
  DeepSearchSourceProgress,
  QueryUnderstanding
} from "./types";

function makeRunId() {
  return `deepsearch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildInitialState(
  runId: string,
  understanding: QueryUnderstanding,
  depth: DeepSearchInput["depth"]
): DeepSearchRunState {
  return {
    runId,
    status: "pending",
    vertical: understanding.vertical,
    depth: depth ?? "standard",
    goal: "",
    currentStep: "created",
    questionsCompleted: 0,
    questionsTotal: 0,
    rawItemCount: 0,
    evidenceCount: 0,
    findingCount: 0,
    evidenceBundleCount: 0,
    opportunityCount: 0
  };
}

export type RunDeepSearchAgentInput = DeepSearchInput & {
  manualVertical?: DeepSearchInput["vertical"];
};

/** 执行一次完整 DeepSearch run；子 Agent 按 question 并发 */
export async function runDeepSearchAgent(
  input: RunDeepSearchAgentInput = {}
): Promise<DeepSearchResult> {
  const runId = makeRunId();
  const query = input.query ?? input.goal ?? "Find source-backed growth opportunities";
  const understanding = understandQuery({
    query,
    manualVertical: input.vertical,
    manualSources: input.requiredSources
  });
  const plan = planResearch({ understanding, request: input });
  const state = buildInitialState(runId, understanding, input.depth);
  state.goal = plan.goal;
  state.planId = plan.id;
  state.questionsTotal = plan.questions.length;
  state.depth = plan.depth;

  const findings: AgentFinding[] = [];
  const observations: DeepSearchObservation[] = [];
  const progress: DeepSearchSourceProgress[] = [];
  const seen = new Set<string>();

  const agentContext: AgentContext = {
    runId,
    vertical: plan.vertical,
    contextBudget: plan.contextBudget,
    lookbackDays: input.lookbackDays ?? 30,
    limitPerSource: input.limitPerSource ?? 4
  };

  state.status = "planning";

  try {
    state.status = "searching";

    const agentTasks: Array<Promise<AgentTaskResult>> = plan.questions.map((question) => {
      const agent = getSourceSubagent(question.agent);
      state.currentStep = `searching:${question.id}`;
      return agent.run({ question, context: agentContext });
    });

    const taskResults = await Promise.all(agentTasks);

    for (const result of taskResults) {
      findings.push(result.finding);
      progress.push(...result.progress);

      for (const observation of result.observations) {
        // 多数据源并发时可能重复 externalId
        const key = `${observation.questionId}:${observation.agent}:${observation.rawItem.externalId}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        observations.push(observation);
      }

      state.questionsCompleted += 1;
    }

    state.rawItemCount = observations.length;
    state.findingCount = findings.length;
    state.evidenceCount = findings.reduce((sum, finding) => sum + finding.evidence.length, 0);

    state.status = "analyzing";
    state.currentStep = "context_manager";
    const contextPlan = applyContextBudget({
      budget: plan.contextBudget,
      observations,
      findings
    });
    const trimmedFindings = reduceFindingsToBudget(findings, plan.contextBudget);
    state.evidenceCount = contextPlan.totalEvidence;

    state.currentStep = "evidence_extractor";
    const bundles = extractEvidenceBundles({
      plan,
      findings: trimmedFindings
    });
    state.evidenceBundleCount = bundles.length;

    state.status = "reporting";
    state.currentStep = "synthesis";
    const reportDraft = synthesiseReport({
      plan,
      findings: trimmedFindings,
      bundles,
      observations
    });
    const report = { ...reportDraft, runId };
    state.opportunityCount = report.topOpportunities.length;

    state.status = bundles.length ? "completed" : "failed";
    state.currentStep = state.status === "completed" ? "completed" : "failed:no-evidence";
    state.error = bundles.length ? undefined : "No evidence bundles were produced";

    return {
      state,
      understanding,
      plan,
      progress,
      findings: trimmedFindings,
      evidenceBundles: bundles,
      report
    };
  } catch (error) {
    state.status = "failed";
    state.currentStep = "failed";
    state.error = error instanceof Error ? error.message : "Unknown DeepSearch failure";

    return {
      state,
      understanding,
      plan,
      progress,
      findings,
      evidenceBundles: [],
      report: {
        runId,
        vertical: plan.vertical,
        depth: plan.depth,
        title: `DeepSearch failed: ${plan.goal}`,
        executiveSummary: state.error,
        whatIsTrending: [],
        userPainPoints: [],
        evidenceTable: [],
        topOpportunities: [],
        recommendedActions: [],
        risks: [state.error],
        nextSearchSuggestions: plan.seedKeywords,
        citations: []
      }
    };
  }
}
