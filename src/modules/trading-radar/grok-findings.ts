import { handlesMatch, parseXStatusUrl } from "./grok-status-url";
import {
  decodeXStatusTimestamp,
  isTimestampWithinWindow,
  timestampsAgree
} from "./x-snowflake";

export type GrokFindingDirection = "LONG" | "SHORT" | "WATCH" | "NONE";
export type GrokStrategyMatch = "MATCH" | "CONFLICT" | "UNKNOWN";

export type GrokFindingInput = {
  creatorHandle?: unknown;
  url?: unknown;
  sourceText?: unknown;
  sourceTextKind?: unknown;
  publishedAt?: unknown;
  language?: unknown;
  postType?: unknown;
  summary?: unknown;
  symbols?: unknown;
  direction?: unknown;
  entryPrice?: unknown;
  entryPriceEvidence?: unknown;
  entryTiming?: unknown;
  entryTimingEvidence?: unknown;
  invalidation?: unknown;
  invalidationEvidence?: unknown;
  strategyMatch?: unknown;
  strategyReason?: unknown;
};

export type AcceptedGrokFinding = {
  creatorHandle: string;
  url: string;
  externalId: string;
  sourceText: string;
  sourceTextKind: string;
  publishedAt: Date;
  language: string;
  postType: string;
  summary: string;
  symbols: string[];
  direction: GrokFindingDirection;
  entryPrice: string;
  entryPriceEvidence: string;
  entryTiming: string;
  entryTimingEvidence: string;
  invalidation: string;
  invalidationEvidence: string;
  strategyMatch: GrokStrategyMatch;
  strategyReason: string;
};

export type RejectedGrokFinding = {
  reason: string;
  finding: unknown;
};

const DIRECTIONS = new Set<GrokFindingDirection>(["LONG", "SHORT", "WATCH", "NONE"]);
const STRATEGY_MATCHES = new Set<GrokStrategyMatch>(["MATCH", "CONFLICT", "UNKNOWN"]);
const UNDEFINED_VALUE = "未明确";

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeEvidence(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, "");
}

function evidenceBoundValue(value: unknown, evidence: unknown, sourceText: string) {
  const text = asString(value, UNDEFINED_VALUE) || UNDEFINED_VALUE;
  if (!text || text === UNDEFINED_VALUE) {
    return UNDEFINED_VALUE;
  }

  const excerpt = normalizeEvidence(asString(evidence));
  if (excerpt.length < 4) {
    return UNDEFINED_VALUE;
  }

  return normalizeEvidence(sourceText).includes(excerpt) ? text : UNDEFINED_VALUE;
}

export function validateGrokFindings(input: {
  findings: unknown;
  accounts: string[];
  window: { since: Date; until: Date };
  maxFindings?: number;
  maxFindingsPerAccount?: number;
}) {
  const accepted: AcceptedGrokFinding[] = [];
  const rejected: RejectedGrokFinding[] = [];
  const seenStatusIds = new Set<string>();
  const perAccount = new Map<string, number>();
  const maxFindings = input.maxFindings ?? 12;
  const maxPerAccount = input.maxFindingsPerAccount ?? 3;
  const accountSet = new Set(input.accounts.map((handle) => handle.replace(/^@/, "").toLowerCase()));

  if (!Array.isArray(input.findings)) {
    return {
      accepted,
      rejected: [{ reason: "findings_not_array", finding: input.findings }]
    };
  }

  for (const finding of input.findings) {
    if (accepted.length >= maxFindings) {
      rejected.push({ reason: "max_findings_exceeded", finding });
      continue;
    }

    if (!finding || typeof finding !== "object") {
      rejected.push({ reason: "finding_not_object", finding });
      continue;
    }

    const row = finding as GrokFindingInput;
    const creatorHandle = asString(row.creatorHandle).replace(/^@/, "");
    if (!creatorHandle || !accountSet.has(creatorHandle.toLowerCase())) {
      rejected.push({ reason: "creator_not_allowed", finding });
      continue;
    }

    const parsedUrl = parseXStatusUrl(asString(row.url));
    if (!parsedUrl) {
      rejected.push({ reason: "invalid_status_url", finding });
      continue;
    }

    if (!handlesMatch(parsedUrl.handle, creatorHandle)) {
      rejected.push({ reason: "url_handle_mismatch", finding });
      continue;
    }

    const statusCreatedAt = decodeXStatusTimestamp(parsedUrl.statusId);
    if (!statusCreatedAt) {
      rejected.push({ reason: "invalid_status_id", finding });
      continue;
    }

    if (!isTimestampWithinWindow(statusCreatedAt, input.window)) {
      rejected.push({ reason: "status_outside_window", finding });
      continue;
    }

    const sourceText = asString(row.sourceText);
    if (!sourceText) {
      rejected.push({ reason: "missing_source_text", finding });
      continue;
    }

    const publishedAtRaw = asString(row.publishedAt);
    const publishedAt = new Date(publishedAtRaw);
    if (!publishedAtRaw || Number.isNaN(publishedAt.getTime())) {
      rejected.push({ reason: "missing_published_at", finding });
      continue;
    }

    if (!timestampsAgree(statusCreatedAt, publishedAt)) {
      rejected.push({ reason: "status_timestamp_mismatch", finding });
      continue;
    }

    if (seenStatusIds.has(parsedUrl.statusId)) {
      rejected.push({ reason: "duplicate_status_id", finding });
      continue;
    }

    const accountKey = creatorHandle.toLowerCase();
    const count = perAccount.get(accountKey) ?? 0;
    if (count >= maxPerAccount) {
      rejected.push({ reason: "max_findings_per_account_exceeded", finding });
      continue;
    }

    const direction = DIRECTIONS.has(row.direction as GrokFindingDirection)
      ? (row.direction as GrokFindingDirection)
      : "NONE";
    const strategyMatch = STRATEGY_MATCHES.has(row.strategyMatch as GrokStrategyMatch)
      ? (row.strategyMatch as GrokStrategyMatch)
      : "UNKNOWN";
    const symbols = Array.isArray(row.symbols)
      ? row.symbols.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 5)
      : [];

    seenStatusIds.add(parsedUrl.statusId);
    perAccount.set(accountKey, count + 1);
    accepted.push({
      creatorHandle,
      url: parsedUrl.canonicalUrl,
      externalId: parsedUrl.statusId,
      sourceText,
      sourceTextKind: asString(row.sourceTextKind, "verbatim_or_search_excerpt") || "verbatim_or_search_excerpt",
      // Prefer deterministic snowflake time over model-declared publishedAt.
      publishedAt: statusCreatedAt,
      language: asString(row.language, "und") || "und",
      postType: asString(row.postType, "original") || "original",
      summary: asString(row.summary),
      symbols,
      direction,
      entryPrice: evidenceBoundValue(row.entryPrice, row.entryPriceEvidence, sourceText),
      entryPriceEvidence: asString(row.entryPriceEvidence),
      entryTiming: evidenceBoundValue(row.entryTiming, row.entryTimingEvidence, sourceText),
      entryTimingEvidence: asString(row.entryTimingEvidence),
      invalidation: evidenceBoundValue(row.invalidation, row.invalidationEvidence, sourceText),
      invalidationEvidence: asString(row.invalidationEvidence),
      strategyMatch,
      strategyReason: asString(row.strategyReason, "未明确") || "未明确"
    });
  }

  return { accepted, rejected };
}
