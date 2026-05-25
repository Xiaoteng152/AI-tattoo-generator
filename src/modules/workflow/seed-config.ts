import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const WORKFLOW_CONFIG_NAME = "AI tattoo generator MVP workflow";

const MVP_WORKFLOW_SOURCES = [
  {
    source: "twitter",
    config: {
      mode: "real",
      provider: "x-api",
      purpose: "keyword search on X/Twitter"
    },
    enabled: true
  }
] as const;

function buildDefaultWorkflowFilters() {
  return {
    minEngagement: 20,
    // 与 X 搜索一致：含中文关键词时不应强制 lang:en，因此 seed config 统一为 any。
    language: "any",
    limitPerSource: Number(process.env.WORKFLOW_X_LIMIT_PER_SOURCE ?? 40),
    maxPages: Number(process.env.WORKFLOW_X_MAX_PAGES ?? 5)
  };
}

async function dedupeWorkflowSources(workflowConfigId: string) {
  const existing = await prisma.workflowSource.findMany({
    where: { workflowConfigId },
    orderBy: { createdAt: "asc" }
  });
  const seen = new Set<string>();

  for (const source of existing) {
    if (seen.has(source.source)) {
      await prisma.workflowSource.delete({ where: { id: source.id } });
      continue;
    }

    seen.add(source.source);
  }
}

async function dedupeWorkflowConfigs() {
  const configs = await prisma.workflowConfig.findMany({
    where: { name: WORKFLOW_CONFIG_NAME },
    orderBy: { createdAt: "asc" }
  });

  if (configs.length <= 1) {
    return configs[0] ?? null;
  }

  const [keep, ...duplicates] = configs;

  for (const duplicate of duplicates) {
    await prisma.workflowRun.updateMany({
      where: { workflowConfigId: duplicate.id },
      data: { workflowConfigId: keep.id }
    });
    await prisma.workflowConfig.delete({ where: { id: duplicate.id } });
  }

  return keep;
}

async function syncWorkflowSources(workflowConfigId: string) {
  await dedupeWorkflowSources(workflowConfigId);

  const existing = await prisma.workflowSource.findMany({
    where: { workflowConfigId }
  });
  const desiredSources = new Set(MVP_WORKFLOW_SOURCES.map((source) => source.source));

  for (const source of existing) {
    if (!desiredSources.has(source.source as (typeof MVP_WORKFLOW_SOURCES)[number]["source"])) {
      await prisma.workflowSource.delete({ where: { id: source.id } });
    }
  }

  for (const desired of MVP_WORKFLOW_SOURCES) {
    const current = existing.find((source) => source.source === desired.source);

    if (current) {
      await prisma.workflowSource.update({
        where: { id: current.id },
        data: {
          config: desired.config as Prisma.InputJsonObject,
          enabled: desired.enabled
        }
      });
      continue;
    }

    await prisma.workflowSource.create({
      data: {
        workflowConfigId,
        source: desired.source,
        config: desired.config as Prisma.InputJsonObject,
        enabled: desired.enabled
      }
    });
  }
}

export async function ensureSeedWorkflowConfig() {
  const canonical = await dedupeWorkflowConfigs();

  const existing =
    canonical ??
    (await prisma.workflowConfig.findFirst({
      where: {
        name: WORKFLOW_CONFIG_NAME
      },
      include: {
        sources: true
      }
    }));

  if (existing) {
    await syncWorkflowSources(existing.id);
    await prisma.workflowConfig.update({
      where: { id: existing.id },
      data: {
        filters: buildDefaultWorkflowFilters()
      }
    });

    return prisma.workflowConfig.findFirstOrThrow({
      where: { id: existing.id },
      include: { sources: true }
    });
  }

  return prisma.workflowConfig.create({
    data: {
      name: WORKFLOW_CONFIG_NAME,
      productDirection: "Crypto trading signals",
      keywords: ["比特币", "以太坊", "bitcoin", "ethereum", "BTC", "ETH"],
      filters: buildDefaultWorkflowFilters(),
      promptVersion: "mvp-v0",
      outputTemplate: "seo-brief-markdown",
      reviewThreshold: 70,
      sources: {
        create: MVP_WORKFLOW_SOURCES.map((source) => ({
          source: source.source,
          config: source.config,
          enabled: source.enabled
        }))
      }
    },
    include: {
      sources: true
    }
  });
}
