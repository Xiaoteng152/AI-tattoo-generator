import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateTradingDigest } from "./digest-service";
import { createXCreatorTimelineClient } from "./x-creator-client";

function xBearerToken() {
  return (process.env.X_BEARER_TOKEN ?? process.env.TWITTER_BEARER_TOKEN)?.trim();
}

export function getConfiguredCreatorTimelineClient() {
  const bearerToken = xBearerToken();
  if (!bearerToken) {
    throw new Error("X API 未配置：请设置 X_BEARER_TOKEN");
  }
  return createXCreatorTimelineClient({ bearerToken });
}

/** 仅同步启用中的博主；停用博主不会被定时或手动全量同步选中 */
export function buildEnabledCreatorFilter(creatorIds?: string[]) {
  return {
    enabled: true as const,
    ...(creatorIds?.length ? { id: { in: creatorIds } } : {})
  };
}

export type CreatorSyncResult = {
  creatorId: string;
  added: number;
  initial: boolean;
  error: string | null;
  analysisError: string | null;
};

export function summarizeCreatorSyncResults(results: CreatorSyncResult[]) {
  const failed = results.filter((result) => result.error !== null || result.analysisError !== null).length;
  const succeeded = results.length - failed;
  const status = failed === 0 ? "success" : succeeded === 0 ? "failed" : "partial";

  return {
    ok: status === "success",
    status,
    total: results.length,
    succeeded,
    failed
  } as const;
}

export async function syncWatchedCreators(creatorIds?: string[]) {
  const client = getConfiguredCreatorTimelineClient();
  const creators = await prisma.watchedCreator.findMany({
    where: buildEnabledCreatorFilter(creatorIds),
    orderBy: { updatedAt: "desc" }
  });

  const results: CreatorSyncResult[] = [];
  for (const creator of creators) {
    const isInitialImport = creator.newestPostId === null;
    try {
      const fetched = await client.fetchLatest({
        creatorId: creator.platformUserId,
        handle: creator.handle,
        sinceId: creator.newestPostId ?? undefined,
        limit: 10
      });
      const created = fetched.posts.length
        ? await prisma.creatorRawItem.createMany({
            data: fetched.posts.map((post) => ({
              creatorId: creator.id,
              externalId: post.externalId,
              sourceUrl: post.sourceUrl,
              body: post.text,
              publishedAt: new Date(post.publishedAt),
              language: post.language,
              postType: post.postType,
              payload: post.rawPayload as Prisma.InputJsonObject,
              isInitialImport
            })),
            skipDuplicates: true
          })
        : { count: 0 };

      await prisma.watchedCreator.update({
        where: { id: creator.id },
        data: {
          newestPostId: fetched.newestPostId ?? creator.newestPostId,
          lastSyncedAt: new Date(),
          lastSyncError: null
        }
      });

      let analysisError: string | null = null;
      if (created.count > 0) {
        try {
          await getOrCreateTradingDigest([creator.id], {
            trigger: "sync",
            isInitialImport
          });
        } catch (error) {
          analysisError = error instanceof Error ? error.message : "AI analysis failed";
        }
      }

      results.push({ creatorId: creator.id, added: created.count, initial: isInitialImport, error: null, analysisError });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Creator sync failed";
      await prisma.watchedCreator.update({
        where: { id: creator.id },
        data: { lastSyncError: message }
      });
      results.push({ creatorId: creator.id, added: 0, initial: isInitialImport, error: message, analysisError: null });
    }
  }

  return results;
}
