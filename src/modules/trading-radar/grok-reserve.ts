import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureTradingStrategy } from "./digest-service";
import {
  DEFAULT_MAX_FINDINGS,
  DEFAULT_MAX_FINDINGS_PER_ACCOUNT,
  GROK_MODEL,
  GROK_REASONING_EFFORT,
  getGrokKeywords,
  getGrokMaxCreators,
  getGrokMaxRunsPerWindow
} from "./grok-config";
import { computeSearchWindow, getQuotaWindow } from "./grok-quota";

export class GrokReserveError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export type GrokReserveConfig = {
  runId: string;
  model: typeof GROK_MODEL;
  reasoningEffort: typeof GROK_REASONING_EFFORT;
  accounts: string[];
  keywords: string[];
  window: { since: string; until: string };
  strategy: { version: number; snapshot: string };
  limits: {
    maxAccounts: number;
    maxFindings: number;
    maxFindingsPerAccount: number;
  };
  quota: {
    used: number;
    limit: number;
    windowStart: string;
    windowEnd: string;
    resetsAt: string;
  };
};

function normalizeHandle(handle: string) {
  return handle.replace(/^@/, "").trim();
}

export async function reserveGrokRun(runId: string, now = new Date()): Promise<GrokReserveConfig> {
  const trimmedRunId = runId.trim();
  if (!trimmedRunId) {
    throw new GrokReserveError("invalid_run_id", 400);
  }

  const maxCreators = getGrokMaxCreators();
  const maxRuns = getGrokMaxRunsPerWindow();
  const keywords = getGrokKeywords();
  const quota = getQuotaWindow(now);
  const strategy = await ensureTradingStrategy();

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.grokRadarRun.findUnique({ where: { id: trimmedRunId } });
      if (existing) {
        return {
          runId: existing.id,
          model: GROK_MODEL,
          reasoningEffort: GROK_REASONING_EFFORT,
          accounts: existing.creatorHandles,
          keywords: existing.keywords,
          window: {
            since: existing.windowStart.toISOString(),
            until: existing.windowEnd.toISOString()
          },
          strategy: {
            version: existing.strategyVersion,
            snapshot: existing.strategySnapshot
          },
          limits: {
            maxAccounts: maxCreators,
            maxFindings: DEFAULT_MAX_FINDINGS,
            maxFindingsPerAccount: DEFAULT_MAX_FINDINGS_PER_ACCOUNT
          },
          quota: {
            used: await tx.grokRadarRun.count({
              where: {
                quotaWindowStart: existing.quotaWindowStart,
                status: { in: ["RESERVED", "RUNNING", "UPLOAD_PENDING", "SUCCEEDED", "FAILED"] }
              }
            }),
            limit: maxRuns,
            windowStart: existing.quotaWindowStart.toISOString(),
            windowEnd: existing.quotaWindowEnd.toISOString(),
            resetsAt: existing.quotaWindowEnd.toISOString()
          }
        } satisfies GrokReserveConfig;
      }

      const used = await tx.grokRadarRun.count({
        where: {
          quotaWindowStart: quota.start,
          status: { in: ["RESERVED", "RUNNING", "UPLOAD_PENDING", "SUCCEEDED", "FAILED"] }
        }
      });

      if (used >= maxRuns) {
        throw new GrokReserveError("weekly_run_limit_reached", 429);
      }

      const creators = await tx.watchedCreator.findMany({
        where: { enabled: true, platform: "x" },
        orderBy: [{ createdAt: "asc" }]
      });

      if (!creators.length) {
        throw new GrokReserveError("no_enabled_creators", 409);
      }

      if (creators.length > maxCreators) {
        throw new GrokReserveError("too_many_enabled_creators", 409);
      }

      const lastSucceeded = await tx.grokRadarRun.findFirst({
        where: { status: "SUCCEEDED" },
        orderBy: { completedAt: "desc" }
      });
      const window = computeSearchWindow({
        now,
        lastSucceededUntil: lastSucceeded?.windowEnd ?? null
      });
      const accounts = creators.map((creator) => normalizeHandle(creator.handle));

      await tx.grokRadarRun.create({
        data: {
          id: trimmedRunId,
          status: "RESERVED",
          quotaWindowStart: quota.start,
          quotaWindowEnd: quota.end,
          windowStart: window.since,
          windowEnd: window.until,
          model: GROK_MODEL,
          reasoningEffort: GROK_REASONING_EFFORT,
          creatorHandles: accounts,
          keywords,
          strategyVersion: strategy.version,
          strategySnapshot: strategy.content
        }
      });

      return {
        runId: trimmedRunId,
        model: GROK_MODEL,
        reasoningEffort: GROK_REASONING_EFFORT,
        accounts,
        keywords,
        window: {
          since: window.since.toISOString(),
          until: window.until.toISOString()
        },
        strategy: {
          version: strategy.version,
          snapshot: strategy.content
        },
        limits: {
          maxAccounts: maxCreators,
          maxFindings: DEFAULT_MAX_FINDINGS,
          maxFindingsPerAccount: DEFAULT_MAX_FINDINGS_PER_ACCOUNT
        },
        quota: {
          used: used + 1,
          limit: maxRuns,
          windowStart: quota.start.toISOString(),
          windowEnd: quota.end.toISOString(),
          resetsAt: quota.resetsAt.toISOString()
        }
      } satisfies GrokReserveConfig;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );
}
