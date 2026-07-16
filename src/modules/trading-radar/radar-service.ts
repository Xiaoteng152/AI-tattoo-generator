import { prisma } from "@/lib/prisma";
import { parseXCreatorHandle } from "./creator-handle";
import { ensureTradingStrategy, findLatestTradingDigest } from "./digest-service";
import { getConfiguredCreatorTimelineClient, syncWatchedCreators } from "./creator-sync";

export async function addWatchedCreator(input: string) {
  const handle = parseXCreatorHandle(input);
  const client = getConfiguredCreatorTimelineClient();
  const resolved = await client.resolveCreator(handle);
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
  const latestDigest = selectedIds.length ? await findLatestTradingDigest(selectedIds) : null;

  return {
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
