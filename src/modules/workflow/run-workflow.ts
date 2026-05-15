import { getConnectors } from "@/modules/connectors";
import { enrichNormalizedItem } from "@/modules/enrichment/enricher";
import { normalizeRawItem } from "@/modules/normalization/normalize";
import { generateSeoBriefMarkdown } from "@/modules/output/markdown";
import { scoreOpportunity } from "@/modules/scoring/opportunity-scorer";
import { prisma } from "@/lib/prisma";
import { ensureSeedWorkflowConfig } from "./seed-config";
import type { Prisma } from "@prisma/client";

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

export async function runMvpWorkflow() {
  const config = await ensureSeedWorkflowConfig();
  const enabledSources = new Set(config.sources.filter((source) => source.enabled).map((source) => source.source));

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

    const extracted = (
      await Promise.all(
        getConnectors()
          .filter((connector) => enabledSources.has(connector.source))
          .map((connector) =>
            connector.extract({
              keywords: config.keywords,
              productDirection: config.productDirection
            })
          )
      )
    ).flat();

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

    await completeStep(extractionStep.id, { rawItems: rawItems.length });

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
          title: `SEO brief: ${opportunity.title}`,
          content: generateSeoBriefMarkdown(opportunity)
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
