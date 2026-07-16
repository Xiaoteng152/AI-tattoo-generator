import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { analyzeTradingPosts, TRADING_PROMPT_VERSION } from "./trading-analyzer";
import type { TradingDigest } from "./trading-digest";
import { deliverTradingDigestToTelegram } from "./telegram-delivery";
import { shouldDeliverTradingDigest } from "./telegram-message";

const DEFAULT_STRATEGY_ID = "default";

function digestInputKey(creatorIds: string[], rawItemIds: string[], strategyVersion: number) {
  return createHash("sha256")
    .update(JSON.stringify({ creatorIds: [...creatorIds].sort(), rawItemIds, strategyVersion, prompt: TRADING_PROMPT_VERSION }))
    .digest("hex");
}

function readStoredDigest(record: { id: string; summary: Prisma.JsonValue; signals: Prisma.JsonValue; createdAt: Date }) {
  return {
    id: record.id,
    digest: {
      summary: Array.isArray(record.summary) ? (record.summary as string[]) : [],
      signals: Array.isArray(record.signals) ? (record.signals as unknown as TradingDigest["signals"]) : []
    },
    createdAt: record.createdAt
  };
}

export async function ensureTradingStrategy() {
  return prisma.tradingStrategy.upsert({
    where: { id: DEFAULT_STRATEGY_ID },
    update: {},
    create: { id: DEFAULT_STRATEGY_ID, content: "", version: 1 }
  });
}

export async function saveTradingStrategy(content: string) {
  const current = await ensureTradingStrategy();
  if (current.content === content.trim()) {
    return current;
  }

  return prisma.tradingStrategy.update({
    where: { id: DEFAULT_STRATEGY_ID },
    data: { content: content.trim(), version: { increment: 1 } }
  });
}

export async function getOrCreateTradingDigest(
  creatorIds: string[],
  options: { force?: boolean; trigger?: "sync" | "manual"; isInitialImport?: boolean } = {}
) {
  const uniqueCreatorIds = Array.from(new Set(creatorIds)).sort();
  if (!uniqueCreatorIds.length) {
    return null;
  }

  const strategy = await ensureTradingStrategy();
  const rawItems = await prisma.creatorRawItem.findMany({
    where: {
      creatorId: { in: uniqueCreatorIds },
      readAt: null
    },
    orderBy: { publishedAt: "desc" },
    take: 10
  });

  if (!rawItems.length) {
    return null;
  }

  const inputKey = digestInputKey(uniqueCreatorIds, rawItems.map((item) => item.id), strategy.version);
  if (!options.force) {
    const existing = await prisma.tradingDigest.findUnique({ where: { inputKey } });
    if (existing) {
      return readStoredDigest(existing);
    }
  }

  const digest = await analyzeTradingPosts({
    strategy: strategy.content,
    posts: rawItems.map((item) => ({ id: item.id, text: item.body, sourceUrl: item.sourceUrl }))
  });
  const persistedKey = options.force ? `${inputKey}:${Date.now()}` : inputKey;
  const record = await prisma.tradingDigest.create({
    data: {
      inputKey: persistedKey,
      creatorIds: uniqueCreatorIds,
      rawItemIds: rawItems.map((item) => item.id),
      summary: digest.summary,
      signals: digest.signals as unknown as Prisma.InputJsonValue,
      promptVersion: TRADING_PROMPT_VERSION,
      strategyId: strategy.id,
      strategyVersion: strategy.version
    }
  });

  if (
    shouldDeliverTradingDigest({
      trigger: options.trigger ?? "manual",
      isInitialImport: options.isInitialImport ?? false
    })
  ) {
    await deliverTradingDigestToTelegram(record.id, digest);
  }
  return { id: record.id, digest, createdAt: record.createdAt };
}

export async function findLatestTradingDigest(creatorIds: string[]) {
  const uniqueCreatorIds = Array.from(new Set(creatorIds)).sort();
  const records = await prisma.tradingDigest.findMany({
    where: { creatorIds: { hasEvery: uniqueCreatorIds } },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  const exact = records.find((record) =>
    record.creatorIds.length === uniqueCreatorIds.length &&
    [...record.creatorIds].sort().every((id, index) => id === uniqueCreatorIds[index])
  );

  return exact ? readStoredDigest(exact) : null;
}
