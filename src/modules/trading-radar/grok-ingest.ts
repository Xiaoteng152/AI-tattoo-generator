import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  GROK_CAPTURE_METHOD,
  GROK_MODEL,
  GROK_PROMPT_VERSION,
  GROK_REASONING_EFFORT,
  DEFAULT_MAX_FINDINGS,
  DEFAULT_MAX_FINDINGS_PER_ACCOUNT
} from "./grok-config";
import { validateGrokFindings, type AcceptedGrokFinding } from "./grok-findings";
import { inspectGrokToolEvidence } from "./grok-tool-evidence";
import { normalizeTradingDigest } from "./trading-digest";
import { deliverTradingDigestToTelegram } from "./telegram-delivery";
import { shouldDeliverTradingDigest } from "./telegram-message";

export class GrokIngestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export type GrokIngestPayload = {
  run: {
    id: string;
    model?: string;
    reasoningEffort?: string;
    accounts?: string[];
    keywords?: string[];
    window?: { since?: string; until?: string };
    strategyVersion?: number;
  };
  result?: {
    findings?: unknown;
    digestSummary?: unknown;
  };
  usage?: unknown;
  stderr?: unknown;
  exitCode?: unknown;
  raw?: unknown;
};

export type GrokIngestResult = {
  ok: true;
  runId: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  digestId: string | null;
  alreadyProcessed?: boolean;
};

function sameStringArray(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const normalizedLeft = left.map((item) => item.toLowerCase()).sort();
  const normalizedRight = right.map((item) => item.toLowerCase()).sort();
  return normalizedLeft.every((item, index) => item === normalizedRight[index]);
}

function buildGrokDigestInputKey(input: {
  runId: string;
  creatorIds: string[];
  rawItemIds: string[];
  strategyVersion: number;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: "grok-cli",
        runId: input.runId,
        creatorIds: [...input.creatorIds].sort(),
        rawItemIds: [...input.rawItemIds].sort(),
        strategyVersion: input.strategyVersion,
        promptVersion: GROK_PROMPT_VERSION
      })
    )
    .digest("hex");
}

function findingToSignal(finding: AcceptedGrokFinding, rawItemId: string) {
  const asset = finding.symbols[0] ?? "未明确";
  return {
    asset,
    direction: finding.direction,
    entryPrice: finding.entryPrice,
    entryPriceEvidence: finding.entryPriceEvidence,
    entryTiming: finding.entryTiming,
    entryTimingEvidence: finding.entryTimingEvidence,
    invalidation: finding.invalidation,
    invalidationEvidence: finding.invalidationEvidence,
    strategyMatch: finding.strategyMatch,
    strategyReason: finding.strategyReason,
    sourcePostIds: [rawItemId]
  };
}

export async function ingestGrokRun(
  payload: GrokIngestPayload,
  options: { idempotencyKey?: string | null } = {}
): Promise<GrokIngestResult> {
  const runId = payload.run?.id?.trim();
  if (!runId) {
    throw new GrokIngestError("invalid_run_id", 400);
  }

  if (options.idempotencyKey && options.idempotencyKey !== runId) {
    throw new GrokIngestError("idempotency_key_mismatch", 400);
  }

  const reserved = await prisma.grokRadarRun.findUnique({ where: { id: runId } });
  if (!reserved) {
    throw new GrokIngestError("run_not_reserved", 409);
  }

  if (reserved.status === "SUCCEEDED" && reserved.ingestionResult) {
    const previous = reserved.ingestionResult as GrokIngestResult;
    return { ...previous, alreadyProcessed: true };
  }

  if (payload.run.model && payload.run.model !== reserved.model) {
    throw new GrokIngestError("reservation_mismatch", 409);
  }
  if (payload.run.reasoningEffort && payload.run.reasoningEffort !== reserved.reasoningEffort) {
    throw new GrokIngestError("reservation_mismatch", 409);
  }
  if (payload.run.accounts && !sameStringArray(payload.run.accounts, reserved.creatorHandles)) {
    throw new GrokIngestError("reservation_mismatch", 409);
  }
  if (payload.run.keywords && !sameStringArray(payload.run.keywords, reserved.keywords)) {
    throw new GrokIngestError("reservation_mismatch", 409);
  }
  if (
    typeof payload.run.strategyVersion === "number" &&
    payload.run.strategyVersion !== reserved.strategyVersion
  ) {
    throw new GrokIngestError("reservation_mismatch", 409);
  }

  const rawPayload = {
    result: payload.result ?? null,
    usage: payload.usage ?? null,
    stderr: payload.stderr ?? null,
    exitCode: payload.exitCode ?? null,
    raw: payload.raw ?? null,
    receivedAt: new Date().toISOString()
  } as Prisma.InputJsonValue;

  // Phase A: persist raw evidence first.
  await prisma.grokRadarRun.update({
    where: { id: runId },
    data: {
      status: reserved.status === "SUCCEEDED" ? reserved.status : "RUNNING",
      rawPayload,
      usage:
        payload.usage === undefined || payload.usage === null
          ? Prisma.JsonNull
          : (payload.usage as Prisma.InputJsonValue),
      error: null
    }
  });

  try {
    const toolEvidence = inspectGrokToolEvidence({
      raw: payload.raw,
      usage: payload.usage,
      result: payload.result,
      stderr: payload.stderr,
      exitCode: payload.exitCode
    });

    if (!toolEvidence.verified) {
      const findingCount = Array.isArray(payload.result?.findings)
        ? payload.result.findings.length
        : 0;
      const result: GrokIngestResult = {
        ok: true,
        runId,
        accepted: 0,
        duplicates: 0,
        rejected: findingCount,
        digestId: null
      };
      await prisma.grokRadarRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          error: toolEvidence.reason,
          ingestionResult: {
            ...result,
            toolEvidence,
            rejectedDetails: [toolEvidence.reason ?? "x_search_not_executed"]
          },
          completedAt: new Date()
        }
      });
      return result;
    }

    const creators = await prisma.watchedCreator.findMany({
      where: {
        platform: "x",
        handle: {
          in: reserved.creatorHandles,
          mode: "insensitive"
        }
      }
    });
    const creatorsByHandle = new Map(
      creators.map((creator) => [creator.handle.toLowerCase(), creator])
    );

    const validation = validateGrokFindings({
      findings: payload.result?.findings,
      accounts: reserved.creatorHandles,
      window: { since: reserved.windowStart, until: reserved.windowEnd },
      maxFindings: DEFAULT_MAX_FINDINGS,
      maxFindingsPerAccount: DEFAULT_MAX_FINDINGS_PER_ACCOUNT
    });

    let accepted = 0;
    let duplicates = 0;
    const persistedIds: string[] = [];
    const signalCandidates: ReturnType<typeof findingToSignal>[] = [];
    const creatorIds = new Set<string>();

    for (const finding of validation.accepted) {
      const creator = creatorsByHandle.get(finding.creatorHandle.toLowerCase());
      if (!creator) {
        validation.rejected.push({ reason: "creator_missing", finding });
        continue;
      }

      const existingCount = await prisma.creatorRawItem.count({
        where: { creatorId: creator.id }
      });
      const isInitialImport = existingCount === 0;

      try {
        const created = await prisma.creatorRawItem.create({
          data: {
            creatorId: creator.id,
            externalId: finding.externalId,
            sourceUrl: finding.url,
            body: finding.sourceText,
            publishedAt: finding.publishedAt,
            language: finding.language,
            postType: finding.postType,
            isInitialImport,
            grokRunId: runId,
            payload: {
              captureMethod: GROK_CAPTURE_METHOD,
              sourceTextKind: finding.sourceTextKind,
              requiresSourceVerification: true,
              summary: finding.summary,
              symbols: finding.symbols,
              direction: finding.direction,
              entryPrice: finding.entryPrice,
              entryPriceEvidence: finding.entryPriceEvidence,
              entryTiming: finding.entryTiming,
              entryTimingEvidence: finding.entryTimingEvidence,
              invalidation: finding.invalidation,
              invalidationEvidence: finding.invalidationEvidence,
              strategyMatch: finding.strategyMatch,
              strategyReason: finding.strategyReason,
              model: GROK_MODEL,
              reasoningEffort: GROK_REASONING_EFFORT
            }
          }
        });
        accepted += 1;
        persistedIds.push(created.id);
        creatorIds.add(creator.id);
        signalCandidates.push(findingToSignal(finding, created.id));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          duplicates += 1;
          const existing = await prisma.creatorRawItem.findUnique({
            where: {
              creatorId_externalId: {
                creatorId: creator.id,
                externalId: finding.externalId
              }
            }
          });
          if (existing) {
            persistedIds.push(existing.id);
            creatorIds.add(creator.id);
            signalCandidates.push(findingToSignal(finding, existing.id));
            if (!existing.grokRunId) {
              await prisma.creatorRawItem.update({
                where: { id: existing.id },
                data: { grokRunId: runId }
              });
            }
          }
          continue;
        }
        throw error;
      }

      await prisma.watchedCreator.update({
        where: { id: creator.id },
        data: {
          lastSyncedAt: new Date(),
          lastSyncError: null,
          newestPostId: finding.externalId
        }
      });
    }

    let digestId: string | null = null;
    const sortedCreatorIds = [...creatorIds].sort();
    const sortedRawItemIds = [...persistedIds].sort();

    // Do not invent a digest from rejected/forged findings.
    if (accepted + duplicates > 0 && persistedIds.length > 0) {
      const digestPosts = await prisma.creatorRawItem.findMany({
        where: { id: { in: persistedIds } }
      });
      const digest = normalizeTradingDigest(
        {
          summary: Array.isArray(payload.result?.digestSummary) ? payload.result?.digestSummary : [],
          signals: signalCandidates
        },
        digestPosts.map((item) => ({
          id: item.id,
          text: item.body,
          sourceUrl: item.sourceUrl
        }))
      );

      const inputKey = buildGrokDigestInputKey({
        runId,
        creatorIds: sortedCreatorIds,
        rawItemIds: sortedRawItemIds,
        strategyVersion: reserved.strategyVersion
      });

      const existingDigest = await prisma.tradingDigest.findUnique({
        where: { sourceGrokRunId: runId }
      });

      if (existingDigest) {
        digestId = existingDigest.id;
      } else {
        const createdDigest = await prisma.tradingDigest.create({
          data: {
            inputKey,
            creatorIds: sortedCreatorIds,
            rawItemIds: sortedRawItemIds,
            summary: digest.summary,
            signals: digest.signals,
            promptVersion: GROK_PROMPT_VERSION,
            strategyId: "default",
            strategyVersion: reserved.strategyVersion,
            strategySnapshot: reserved.strategySnapshot,
            sourceGrokRunId: runId
          }
        });
        digestId = createdDigest.id;

        if (shouldDeliverTradingDigest({ trigger: "sync", isInitialImport: false })) {
          await deliverTradingDigestToTelegram(createdDigest.id, digest).catch(() => undefined);
        }
      }
    }

    const result: GrokIngestResult = {
      ok: true,
      runId,
      accepted,
      duplicates,
      rejected: validation.rejected.length,
      digestId
    };

    await prisma.grokRadarRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        ingestionResult: {
          ...result,
          toolEvidence,
          rejectedDetails: validation.rejected.map((item) => item.reason)
        },
        completedAt: new Date(),
        error: null
      }
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "ingest_failed";
    await prisma.grokRadarRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        error: message,
        completedAt: new Date()
      }
    });
    throw error;
  }
}
