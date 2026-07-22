import { prisma } from "@/lib/prisma";
import { parseXCreatorInput } from "./creator-handle";
import { ensureTradingStrategy, findLatestTradingDigest } from "./digest-service";
import { getConfiguredCreatorTimelineClient, syncWatchedCreators } from "./creator-sync";
import {
  getGrokMaxCreators,
  GROK_MODEL,
  GROK_REASONING_EFFORT,
  isGrokCliSource
} from "./grok-config";
import { getQuotaWindow, nextScheduledRunAt } from "./grok-quota";

export class CreatorLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreatorLimitError";
  }
}

async function assertCanEnableCreator(excludeId?: string) {
  const maxCreators = getGrokMaxCreators();
  const enabledCount = await prisma.watchedCreator.count({
    where: {
      enabled: true,
      ...(excludeId ? { id: { not: excludeId } } : {})
    }
  });

  if (enabledCount >= maxCreators) {
    throw new CreatorLimitError(`最多只能启用 ${maxCreators} 个博主`);
  }
}

export async function addWatchedCreator(input: string) {
  const parsed = parseXCreatorInput(input);
  const existing = await prisma.watchedCreator.findUnique({
    where: { platform_handle: { platform: "x", handle: parsed.handle } }
  });

  if (existing?.enabled) {
    return { creator: existing, sync: null };
  }

  if (!existing || !existing.enabled) {
    await assertCanEnableCreator(existing?.id);
  }

  if (isGrokCliSource()) {
    const creator = await prisma.watchedCreator.upsert({
      where: { platform_handle: { platform: "x", handle: parsed.handle } },
      update: {
        displayName: `@${parsed.displayHandle}`,
        enabled: true,
        lastSyncError: null
      },
      create: {
        platform: "x",
        platformUserId: `handle:${parsed.handle}`,
        handle: parsed.handle,
        displayName: `@${parsed.displayHandle}`,
        avatarUrl: null,
        enabled: true
      }
    });
    return { creator, sync: null };
  }

  const client = getConfiguredCreatorTimelineClient();
  const resolved = await client.resolveCreator(parsed.handle);
  const creator = await prisma.watchedCreator.upsert({
    where: { platform_handle: { platform: "x", handle: resolved.handle } },
    update: {
      platformUserId: resolved.platformUserId,
      displayName: resolved.displayName,
      avatarUrl: resolved.avatarUrl,
      enabled: true,
      lastSyncError: null
    },
    create: {
      platform: "x",
      platformUserId: resolved.platformUserId,
      handle: resolved.handle,
      displayName: resolved.displayName,
      avatarUrl: resolved.avatarUrl
    }
  });
  const sync = await syncWatchedCreators([creator.id]);
  return { creator, sync: sync[0] ?? null };
}

export async function setWatchedCreatorEnabled(id: string, enabled: boolean) {
  if (enabled) {
    await assertCanEnableCreator(id);
  }

  return prisma.watchedCreator.update({
    where: { id },
    data: { enabled }
  });
}

export async function getGrokRadarStatus(now = new Date()) {
  if (!isGrokCliSource()) {
    return null;
  }

  const quota = getQuotaWindow(now);
  const used = await prisma.grokRadarRun.count({
    where: {
      quotaWindowStart: quota.start,
      status: { in: ["RESERVED", "RUNNING", "UPLOAD_PENDING", "SUCCEEDED", "FAILED"] }
    }
  });
  const lastRun = await prisma.grokRadarRun.findFirst({
    orderBy: [{ completedAt: "desc" }, { reservedAt: "desc" }]
  });
  const lastSucceeded = await prisma.grokRadarRun.findFirst({
    where: { status: "SUCCEEDED" },
    orderBy: { completedAt: "desc" }
  });

  return {
    model: GROK_MODEL,
    reasoningEffort: GROK_REASONING_EFFORT,
    lastRunAt: lastRun?.completedAt?.toISOString() ?? lastRun?.reservedAt.toISOString() ?? null,
    lastRunStatus: lastRun?.status ?? null,
    lastSucceededAt: lastSucceeded?.completedAt?.toISOString() ?? null,
    lastError: lastRun?.status === "FAILED" ? lastRun.error : null,
    nextRunAt: nextScheduledRunAt(now)?.toISOString() ?? null,
    quota: {
      used,
      limit: Number(process.env.GROK_RADAR_MAX_RUNS_PER_WINDOW ?? 2),
      resetsAt: quota.resetsAt.toISOString()
    }
  };
}

export async function getTradingRadarSnapshot(creatorIds?: string[]) {
  const creators = await prisma.watchedCreator.findMany({
    orderBy: [{ lastSyncedAt: "desc" }, { createdAt: "desc" }]
  });
  const selectedIds = creatorIds?.length
    ? creatorIds.filter((id) => creators.some((creator) => creator.id === id))
    : creators[0]
      ? [creators[0].id]
      : [];
  const rawItems = await prisma.creatorRawItem.findMany({
    where: selectedIds.length ? { creatorId: { in: selectedIds } } : undefined,
    include: { creator: true },
    orderBy: { publishedAt: "desc" },
    take: 100
  });
  const unreadCounts = await prisma.creatorRawItem.groupBy({
    by: ["creatorId"],
    where: { readAt: null, isInitialImport: false },
    _count: { _all: true }
  });
  const unreadByCreator = new Map(unreadCounts.map((entry) => [entry.creatorId, entry._count._all]));
  const strategy = await ensureTradingStrategy();
  const latestDigest = selectedIds.length
    ? await findLatestTradingDigest(selectedIds)
    : null;
  const grokStatus = await getGrokRadarStatus();

  return {
    sourceMode: isGrokCliSource() ? "grok-cli" : "x-api",
    grokStatus,
    maxCreators: getGrokMaxCreators(),
    creators: creators.map((creator) => ({ ...creator, unreadCount: unreadByCreator.get(creator.id) ?? 0 })),
    selectedIds,
    posts: rawItems,
    strategy,
    latestDigest,
    integrations: {
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      xConfigured: Boolean(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN)
    }
  };
}

export async function markCreatorPostRead(postId: string) {
  return prisma.creatorRawItem.update({ where: { id: postId }, data: { readAt: new Date() } });
}

export async function markCreatorPostsRead(creatorIds: string[]) {
  return prisma.creatorRawItem.updateMany({
    where: { creatorId: { in: creatorIds }, readAt: null, isInitialImport: false },
    data: { readAt: new Date() }
  });
}
