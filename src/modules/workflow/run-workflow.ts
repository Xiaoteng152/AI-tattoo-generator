import { getConnectorsForWorkflowSources } from "@/modules/connectors";
import { enrichNormalizedItem } from "@/modules/enrichment/enricher";
import { normalizeRawItem } from "@/modules/normalization/normalize";
import { generateSeoBriefMarkdown } from "@/modules/output/markdown";
import { scoreOpportunity } from "@/modules/scoring/opportunity-scorer";
import { prisma } from "@/lib/prisma";
import { ensureSeedWorkflowConfig } from "./seed-config";
import type { Prisma } from "@prisma/client";

function truncateTitle(title: string, maxLength = 96) {
  const compact = title.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

async function completeStep(id: string, metadata?: Prisma.InputJsonObject) {
  return prisma.runStep.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      metadata: metadata ?? undefined
    }
  });
}

async function failRun(runId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown workflow failure";

  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      error: message
    }
  });

  return message;
}

export type RunMvpWorkflowInput = {
  keywords?: string[];
  productDirection?: string;
};

export async function runMvpWorkflow(input: RunMvpWorkflowInput = {}) {
  const config = await ensureSeedWorkflowConfig();
  const connectors = getConnectorsForWorkflowSources(config.sources, { allowMockFallback: false });
  // 运行时 POST 参数覆盖 DB 里的 seed config，Dashboard 可直接改关键词/产品方向。
  const keywords = input.keywords?.length ? input.keywords : config.keywords;
  const productDirection = input.productDirection?.trim() || config.productDirection;
  const filters = (config.filters ?? {}) as {
    limitPerSource?: number;
    maxPages?: number;
    lookbackDays?: number;
  };
  const limitPerSource = filters.limitPerSource ?? Number(process.env.WORKFLOW_X_LIMIT_PER_SOURCE ?? 40);
  const maxPages = filters.maxPages ?? Number(process.env.WORKFLOW_X_MAX_PAGES ?? 5);
  const lookbackDays = filters.lookbackDays ?? 30;

  const run = await prisma.workflowRun.create({
    data: {
      workflowConfigId: config.id,
      status: "RUNNING",
      startedAt: new Date()
    }
  });

  try {
    const extractionStep = await prisma.runStep.create({
      data: {
        workflowRunId: run.id,
        name: "extract",
        status: "RUNNING",
        startedAt: new Date()
      }
    });

    const extractionResults = await Promise.all(
      connectors.map(async (connector) => {
        try {
          const items = await connector.extract({
            keywords,
            productDirection,
            limitPerSource,
            maxPages,
            lookbackDays
          });

          return { connector, items, error: null as string | null };
        } catch (error) {
          // 单源失败不阻断整次 run；全部源失败时在下方统一抛错。
          console.error("[workflow] connector extract failed", {
            source: connector.source,
            errorType: error instanceof Error ? error.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
            causeType:
              error instanceof Error && error.cause instanceof Error
                ? error.cause.name
                : error instanceof Error && error.cause
                  ? typeof error.cause
                  : null,
            causeCode:
              error instanceof Error &&
              error.cause &&
              typeof error.cause === "object" &&
              "code" in error.cause &&
              typeof error.cause.code === "string"
                ? error.cause.code
                : null
          });

          return {
            connector,
            items: [],
            error: error instanceof Error ? error.message : "Unknown connector error"
          };
        }
      })
    );

    const extracted = extractionResults.flatMap((result) => result.items);
    const sourceErrors = extractionResults
      .filter((result) => result.error)
      .map((result) => ({
        source: result.connector.source,
        error: result.error
      }));

    if (!extracted.length) {
      throw new Error(
        sourceErrors.length
          ? sourceErrors.map((entry) => `${entry.source}: ${entry.error}`).join("; ")
          : "No items extracted from configured sources"
      );
    }

    const rawItems = await Promise.all(
      extracted.map((item) =>
        prisma.rawItem.upsert({
          where: {
            source_externalId: {
              source: item.source,
              externalId: item.externalId
            }
          },
          update: {
            workflowRunId: run.id,
            title: item.title,
            sourceUrl: item.sourceUrl,
            payload: item.payload as Prisma.InputJsonObject,
            metrics: item.metrics as Prisma.InputJsonObject,
            fetchedAt: new Date()
          },
          create: {
            workflowRunId: run.id,
            source: item.source,
            externalId: item.externalId,
            sourceUrl: item.sourceUrl,
            title: item.title,
            payload: item.payload as Prisma.InputJsonObject,
            metrics: item.metrics as Prisma.InputJsonObject
          }
        })
      )
    );

    await completeStep(extractionStep.id, {
      rawItems: rawItems.length,
      sourceResults: extractionResults.map((result) => ({
        source: result.connector.source,
        mode: result.connector.mode,
        ok: !result.error,
        itemCount: result.items.length,
        error: result.error ?? undefined
      }))
    });

    const normalizationStep = await prisma.runStep.create({
      data: {
        workflowRunId: run.id,
        name: "normalize",
        status: "RUNNING",
        startedAt: new Date()
      }
    });

    const normalizedItems = await Promise.all(
      rawItems.map((rawItem, index) => {
        const normalized = normalizeRawItem(extracted[index]);

        return prisma.normalizedItem.create({
          data: {
            workflowRunId: run.id,
            rawItemId: rawItem.id,
            ...normalized
          }
        });
      })
    );

    await completeStep(normalizationStep.id, { normalizedItems: normalizedItems.length });

    const enrichmentStep = await prisma.runStep.create({
      data: {
        workflowRunId: run.id,
        name: "enrich-and-score",
        status: "RUNNING",
        startedAt: new Date()
      }
    });

    const opportunities = [];

    for (const normalizedItem of normalizedItems) {
      const normalized = {
        source: normalizedItem.source,
        title: normalizedItem.title,
        body: normalizedItem.body,
        author: normalizedItem.author ?? undefined,
        sourceUrl: normalizedItem.sourceUrl,
        tags: normalizedItem.tags,
        language: normalizedItem.language,
        engagementScore: normalizedItem.engagementScore
      };
      const enrichment = await enrichNormalizedItem(normalized);
      const savedEnrichment = await prisma.enrichment.create({
        data: {
          workflowRunId: run.id,
          normalizedItemId: normalizedItem.id,
          ...enrichment
        }
      });
      const draft = scoreOpportunity(normalized, enrichment);
      const opportunity = await prisma.opportunity.create({
        data: {
          workflowRunId: run.id,
          ...draft
        }
      });

      await prisma.outputAsset.create({
        data: {
          workflowRunId: run.id,
          opportunityId: opportunity.id,
          type: "seo-brief",
          title: `SEO brief: ${truncateTitle(opportunity.title)}`,
          content: generateSeoBriefMarkdown(opportunity, {
            // 必须用运行时 productDirection，不能用 DB seed config 里的旧垂类名。
            productDirection,
            keywords: savedEnrichment.keywords,
            painPoints: savedEnrichment.painPoints
          })
        }
      });

      opportunities.push({ opportunity, enrichment: savedEnrichment });
    }

    await completeStep(enrichmentStep.id, {
      enrichments: opportunities.length,
      opportunities: opportunities.length
    });

    return prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        summary: {
          productDirection,
          keywords,
          rawItems: rawItems.length,
          normalizedItems: normalizedItems.length,
          opportunities: opportunities.length,
          outputAssets: opportunities.length
        }
      },
      include: {
        workflowConfig: true,
        steps: true,
        opportunities: {
          orderBy: {
            score: "desc"
          }
        },
        outputAssets: true
      }
    });
  } catch (error) {
    const message = await failRun(run.id, error);
    throw new Error(message);
  }
}
