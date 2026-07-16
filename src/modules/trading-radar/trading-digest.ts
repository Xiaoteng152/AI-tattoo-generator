export type TradingDigestPost = {
  id: string;
  text: string;
  sourceUrl: string;
};

export type TradingSignal = {
  asset: string;
  direction: "LONG" | "SHORT" | "WATCH" | "NONE";
  entryPrice: string;
  entryTiming: string;
  invalidation: string;
  strategyMatch: "MATCH" | "CONFLICT" | "UNKNOWN";
  strategyReason: string;
  sourcePostIds: string[];
  sourceUrls: string[];
};

export type TradingDigest = {
  summary: string[];
  signals: TradingSignal[];
};

type CandidateSignal = Partial<TradingSignal> & {
  entryPriceEvidence?: unknown;
  entryTimingEvidence?: unknown;
  invalidationEvidence?: unknown;
};

type CandidateDigest = {
  summary?: unknown;
  signals?: unknown;
};

const DIRECTIONS = new Set<TradingSignal["direction"]>(["LONG", "SHORT", "WATCH", "NONE"]);
const STRATEGY_MATCHES = new Set<TradingSignal["strategyMatch"]>(["MATCH", "CONFLICT", "UNKNOWN"]);
const UNDEFINED_VALUE = "未明确";

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeEvidence(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, "");
}

function hasEvidence(evidence: unknown, posts: TradingDigestPost[]) {
  const excerpt = normalizeEvidence(asString(evidence));
  return excerpt.length >= 4 && posts.some((post) => normalizeEvidence(post.text).includes(excerpt));
}

function evidenceBoundValue(value: unknown, evidence: unknown, posts: TradingDigestPost[]) {
  const text = asString(value, UNDEFINED_VALUE);
  if (!text || text === UNDEFINED_VALUE) {
    return UNDEFINED_VALUE;
  }

  return hasEvidence(evidence, posts) ? text : UNDEFINED_VALUE;
}

export function normalizeTradingDigest(candidate: CandidateDigest, posts: TradingDigestPost[]): TradingDigest {
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const summary = Array.isArray(candidate.summary)
    ? candidate.summary
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 3)
        .map((item) => Array.from(item.trim()).slice(0, 40).join(""))
    : [];
  const signalCandidates = Array.isArray(candidate.signals) ? (candidate.signals as CandidateSignal[]) : [];

  const signals = signalCandidates.slice(0, 3).flatMap((signal): TradingSignal[] => {
    const sourcePostIds = Array.isArray(signal.sourcePostIds)
      ? signal.sourcePostIds.filter((id): id is string => typeof id === "string" && postsById.has(id))
      : [];

    if (!sourcePostIds.length) {
      return [];
    }

    const sourcePosts = sourcePostIds.map((id) => postsById.get(id)).filter((post): post is TradingDigestPost => Boolean(post));
    const direction = DIRECTIONS.has(signal.direction as TradingSignal["direction"])
      ? (signal.direction as TradingSignal["direction"])
      : "NONE";
    const strategyMatch = STRATEGY_MATCHES.has(signal.strategyMatch as TradingSignal["strategyMatch"])
      ? (signal.strategyMatch as TradingSignal["strategyMatch"])
      : "UNKNOWN";

    return [
      {
        asset: asString(signal.asset, UNDEFINED_VALUE),
        direction,
        entryPrice: evidenceBoundValue(signal.entryPrice, signal.entryPriceEvidence, sourcePosts),
        entryTiming: evidenceBoundValue(signal.entryTiming, signal.entryTimingEvidence, sourcePosts),
        invalidation: evidenceBoundValue(signal.invalidation, signal.invalidationEvidence, sourcePosts),
        strategyMatch,
        strategyReason: asString(signal.strategyReason, UNDEFINED_VALUE),
        sourcePostIds,
        sourceUrls: sourcePosts.map((post) => post.sourceUrl)
      }
    ];
  });

  return { summary, signals };
}
