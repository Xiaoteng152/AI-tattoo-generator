import { getConnectors } from "@/modules/connectors";
import type { Connector, SourceName } from "@/modules/connectors/types";
import { enrichItem } from "@/modules/enrichment/enricher";
import { normalizeRawItem } from "@/modules/normalization/normalize";
import { compressEvidenceBundles } from "./evidence-compressor";
import { createDefaultDeepSearchPlan } from "./planner";
import { writeDeepSearchReport } from "./report-writer";
import type { DeepSearchInput, DeepSearchObservation, DeepSearchResult, DeepSearchRunState, DeepSearchSourceProgress } from "./types";

const connectorSources: SourceName[] = ["reddit", "etsy", "twitter"];

function makeRunId() {
  return `deepsearch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isConnectorSource(source: string): source is SourceName {
  return connectorSources.includes(source as SourceName);
}

function getConnector(source: SourceName): Connector | undefined {
  return getConnectors({ allowMockFallback: true, sources: [source] })[0];
}

function initialState(runId: string, goal: string): DeepSearchRunState {
  return {
    runId,
    status: "pending",
    goal,
    currentStep: "created",
    questionsCompleted: 0,
    questionsTotal: 0,
    rawItemCount: 0,
    evidenceBundleCount: 0,
    opportunityCount: 0
  };
}

export async function runDeepSearchAgent(input: DeepSearchInput = {}): Promise<DeepSearchResult> {
  const runId = makeRunId();
  const plan = createDefaultDeepSearchPlan(input);
  const state = initialState(runId, plan.goal);
  const progress: DeepSearchSourceProgress[] = [];
  const observations: DeepSearchObservation[] = [];
  const seen = new Set<string>();

  state.status = "running";
  state.planId = plan.id;
  state.currentStep = "planning";
  state.questionsTotal = plan.questions.length;

  try {
    for (const question of plan.questions) {
      state.currentStep = `search:${question.id}`;

      for (const source of question.sources) {
        const sourceStartedAt = Date.now();

        if (!isConnectorSource(source)) {
          progress.push({
            questionId: question.id,
            query: question.queries[0] ?? plan.seedKeywords[0],
            source,
            ok: false,
            itemCount: 0,
            durationMs: Date.now() - sourceStartedAt,
            error: `${source} connector is planned but not implemented yet`
          });
          continue;
        }

        const connector = getConnector(source);

        if (!connector) {
          progress.push({
            questionId: question.id,
            query: question.queries[0] ?? plan.seedKeywords[0],
            source,
            ok: false,
            itemCount: 0,
            durationMs: Date.now() - sourceStartedAt,
            error: `${source} connector is not available in the current connector mode`
          });
          continue;
        }

        const query = question.queries[0] ?? plan.seedKeywords[0];

        try {
          const rawItems = await connector.extract({
            productDirection: plan.goal,
            keywords: [query],
            limitPerSource: input.limitPerSource ?? 4,
            lookbackDays: input.lookbackDays ?? 30
          });

          for (const rawItem of rawItems) {
            const observationKey = `${question.id}:${rawItem.source}:${rawItem.externalId}`;

            if (seen.has(observationKey)) {
              continue;
            }

            seen.add(observationKey);

            const normalized = normalizeRawItem(rawItem);
            const enrichment = await enrichItem(normalized);
            observations.push({
              questionId: question.id,
              query,
              source: rawItem.source,
              rawItem: {
                externalId: rawItem.externalId,
                sourceUrl: rawItem.sourceUrl,
                title: rawItem.title,
                author: rawItem.author,
                metrics: rawItem.metrics
              },
              normalized,
              enrichment
            });
          }

          progress.push({
            questionId: question.id,
            query,
            source,
            ok: true,
            itemCount: rawItems.length,
            durationMs: Date.now() - sourceStartedAt
          });
        } catch (error) {
          progress.push({
            questionId: question.id,
            query,
            source,
            ok: false,
            itemCount: 0,
            durationMs: Date.now() - sourceStartedAt,
            error: error instanceof Error ? error.message : "Unknown connector error"
          });
        }
      }

      state.questionsCompleted += 1;
      state.rawItemCount = observations.length;
    }

    state.currentStep = "compress";
    const evidenceBundles = compressEvidenceBundles(plan, observations);
    state.evidenceBundleCount = evidenceBundles.length;

    state.currentStep = "report";
    const report = writeDeepSearchReport(runId, plan, evidenceBundles, observations);
    state.opportunityCount = report.topOpportunities.length;
    state.status = observations.length ? "completed" : "failed";
    state.currentStep = state.status === "completed" ? "completed" : "failed:no-evidence";
    state.error = observations.length ? undefined : "No source evidence was collected";

    return {
      state,
      plan,
      progress,
      evidenceBundles,
      report
    };
  } catch (error) {
    state.status = "failed";
    state.currentStep = "failed";
    state.error = error instanceof Error ? error.message : "Unknown DeepSearch failure";

    return {
      state,
      plan,
      progress,
      evidenceBundles: [],
      report: {
        runId,
        title: `DeepSearch failed: ${plan.goal}`,
        summary: state.error,
        topOpportunities: [],
        risks: [state.error],
        nextSearchSuggestions: plan.seedKeywords
      }
    };
  }
}
