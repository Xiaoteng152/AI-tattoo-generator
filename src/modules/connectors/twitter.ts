import { createAuthFetch } from "@/lib/auth-fetch";
import {
  compareSopilotTweetHeat,
  fetchSopilotHotTweets,
  type SopilotTweet
} from "@/lib/sopilot-hot-tweets";
import type { Connector, ConnectorInput, ExtractedRawItem } from "./types";

const outboundFetch = createAuthFetch();

function getErrorDetails(error: unknown) {
  const cause = error instanceof Error ? error.cause : undefined;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
      ? cause.code
      : undefined;

  return {
    errorType: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    causeType: cause instanceof Error ? cause.name : cause ? typeof cause : undefined,
    causeCode: causeCode ?? null
  };
}

function logConnectorError(scope: string, error: unknown, context: Record<string, unknown> = {}) {
  console.error(`[twitter-connector] ${scope}`, {
    ...getErrorDetails(error),
    ...context
  });
}

function formatOutboundFetchError(error: unknown, target: string) {
  const cause = error instanceof Error ? error.cause : undefined;
  const code =
    cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
      ? cause.code
      : undefined;

  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ECONNREFUSED" || code === "ENOTFOUND") {
    return `Cannot reach ${target} from this environment. Set HTTPS_PROXY in .env, enable VPN, or deploy to Vercel.`;
  }

  return error instanceof Error ? error.message : `Request to ${target} failed`;
}

async function fetchOutbound(input: RequestInfo | URL, init?: RequestInit) {
  const target = String(input);

  try {
    return await outboundFetch(input, init);
  } catch (error) {
    logConnectorError("fetch failed", error, { target });
    throw new Error(formatOutboundFetchError(error, target), { cause: error });
  }
}

type XTweet = {
  id?: string;
  text?: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    impression_count?: number;
  };
};

type XUser = {
  id?: string;
  name?: string;
  username?: string;
};

type XSearchResponse = {
  data?: XTweet[];
  meta?: {
    next_token?: string;
    result_count?: number;
  };
  includes?: {
    users?: XUser[];
  };
  errors?: Array<{
    title?: string;
    detail?: string;
  }>;
};

const xSearchUrl = "https://api.x.com/2/tweets/search/recent";
// Workflow 单次抓取上限；SoPilot RSS 实际只有 ~45 条，因此 fallback 场景主要靠 minResults 补足。
const DEFAULT_LIMIT_PER_SOURCE = Number(process.env.WORKFLOW_X_LIMIT_PER_SOURCE ?? 40);
const DEFAULT_MAX_PAGES = Number(process.env.WORKFLOW_X_MAX_PAGES ?? 5);
// SoPilot fallback 时，关键词命中不足则用热帖填充到此数量（不超过 limit）。
const DEFAULT_SOPILOT_MIN_RESULTS = Number(process.env.WORKFLOW_SOPILOT_MIN_RESULTS ?? 10);
// 交易垂类在 SoPilot 本地过滤时会额外扩词，弥补 RSS 池子小、正文表述分散的问题。
const SOPILOT_CRYPTO_SYNONYMS = [
  "比特币",
  "以太坊",
  "bitcoin",
  "ethereum",
  "加密",
  "区块链",
  "币圈",
  "crypto",
  "web3",
  "数字货币",
  "合约",
  "炒币",
  "链上",
  "defi"
];

function getXBearerToken() {
  return (process.env.X_BEARER_TOKEN ?? process.env.TWITTER_BEARER_TOKEN)?.trim();
}

class XApiHttpError extends Error {
  readonly status: number;
  readonly bodyPreview?: string;

  constructor(message: string, status: number, bodyPreview?: string) {
    super(message);
    this.name = "XApiHttpError";
    this.status = status;
    this.bodyPreview = bodyPreview;
  }
}

function shouldFallbackFromXApi(error: unknown) {
  // 401/402/403 表示 Token 或套餐问题，本地 MVP 可降级到 SoPilot RSS。
  if (process.env.TWITTER_AUTH_FALLBACK === "none") {
    return false;
  }

  if (error instanceof XApiHttpError) {
    return error.status === 401 || error.status === 402 || error.status === 403;
  }

  return false;
}

function formatXApiAuthError(status: number) {
  if (status === 401) {
    return "X/Twitter Bearer Token is invalid or expired. Regenerate Bearer Token in developer.x.com → Apps → Keys and tokens, update X_BEARER_TOKEN, then restart npm run dev.";
  }

  if (status === 402) {
    return "X/Twitter account has no API credits for search. Add credits in developer.x.com → Billing, or rely on TWITTER_AUTH_FALLBACK=sopilot for local MVP.";
  }

  if (status === 403) {
    return "X/Twitter app lacks access to search endpoints. Upgrade API access (Basic or above) or set TWITTER_AUTH_FALLBACK=sopilot.";
  }

  return `X/Twitter API failed with status ${status}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function keywordMatchesText(text: string, keyword: string) {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return false;
  }

  const normalizedText = text.toLowerCase();
  const normalizedKeyword = trimmed.toLowerCase();

  // 中文/多词/长词走子串；短 ticker（BTC/ETH）要求词边界，避免 handle 误命中。
  if (/[\u3400-\u9fff]/.test(trimmed) || /\s/.test(trimmed) || trimmed.length > 4) {
    return normalizedText.includes(normalizedKeyword);
  }

  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(normalizedKeyword)}(?:[^a-z0-9]|$)`, "i");
  return pattern.test(text);
}

export function findMatchedKeywords(haystack: string, keywords: string[]) {
  return keywords.filter((keyword) => keywordMatchesText(haystack, keyword));
}

function isCryptoContext(input: ConnectorInput) {
  const context = `${input.productDirection} ${input.keywords.join(" ")}`.toLowerCase();
  return /crypto|trading|交易|比特币|以太坊|bitcoin|ethereum|\bbtc\b|\beth\b|web3|币圈|区块链/.test(context);
}

function expandSopilotKeywords(input: ConnectorInput) {
  if (!isCryptoContext(input)) {
    return input.keywords;
  }

  return Array.from(new Set([...input.keywords, ...SOPILOT_CRYPTO_SYNONYMS]));
}

function prioritizeMatchedKeywords(matchedKeywords: string[], userKeywords: string[]) {
  const userSet = new Set(userKeywords.map((keyword) => keyword.trim().toLowerCase()));
  const preferred = matchedKeywords.filter((keyword) => userSet.has(keyword.trim().toLowerCase()));
  return preferred.length ? preferred : matchedKeywords;
}

function quoteKeyword(keyword: string) {
  const trimmed = keyword.trim();
  return /\s/.test(trimmed) ? `"${trimmed.replaceAll('"', '\\"')}"` : trimmed;
}

export function buildXSearchQuery(input: ConnectorInput) {
  const keywords = input.keywords.length ? input.keywords : [input.productDirection];
  const keywordQuery = keywords.slice(0, 8).map(quoteKeyword).join(" OR ");
  const hasCjk = keywords.some((keyword) => /[\u3400-\u9fff]/.test(keyword));

  // 含中文关键词时不加 lang:en，否则会把中文帖过滤掉。
  return hasCjk ? `${keywordQuery} -is:retweet` : `${keywordQuery} -is:retweet lang:en`;
}

function firstTextLine(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

function mapSopilotTweetToRawItem(
  tweet: SopilotTweet,
  matchedKeywords: string[],
  productDirection: string
): ExtractedRawItem {
  return {
    source: "twitter",
    externalId: `sopilot-twitter-${tweet.externalId}`,
    sourceUrl: tweet.sourceUrl,
    title: firstTextLine(tweet.body),
    body: tweet.body,
    author: tweet.handle ? `@${tweet.handle}` : tweet.authorName,
    publishedAt: tweet.publishedAt,
    tags: Array.from(new Set(["sopilot-hot-tweet", "real-twitter", ...matchedKeywords])),
    metrics: {
      favorites: tweet.favorites,
      retweets: tweet.reposts,
      replies: tweet.comments,
      saves: tweet.saves,
      views: tweet.views
    },
    payload: {
      provider: "sopilot",
      authorName: tweet.authorName,
      handle: tweet.handle,
      sopilotUrl: tweet.sopilotUrl,
      viralProbability: tweet.viralProbability,
      predictedViews: tweet.predictedViews,
      predictedCommentViews: tweet.predictedCommentViews,
      matchedKeywords,
      productDirection
    }
  };
}

function shouldUseOfficialXApi() {
  if (process.env.TWITTER_SOURCE === "sopilot") {
    return false;
  }

  return (
    process.env.TWITTER_SOURCE === "x-api" ||
    process.env.TWITTER_SOURCE === "official" ||
    Boolean(getXBearerToken())
  );
}

function mapXTweetToRawItem(
  tweet: XTweet,
  usersById: Map<string | undefined, XUser | undefined>,
  input: ConnectorInput
): ExtractedRawItem | null {
  if (!tweet.id || !tweet.text) {
    return null;
  }

  const author = usersById.get(tweet.author_id);
  const metrics = tweet.public_metrics ?? {};
  const matchedKeywords = findMatchedKeywords(tweet.text ?? "", input.keywords);
  const engagement =
    (metrics.like_count ?? 0) +
    (metrics.retweet_count ?? 0) * 2 +
    (metrics.reply_count ?? 0) * 2 +
    (metrics.impression_count ?? 0) / 1000;

  return {
    source: "twitter",
    externalId: `twitter-${tweet.id}`,
    sourceUrl: author?.username ? `https://x.com/${author.username}/status/${tweet.id}` : `https://x.com/i/web/status/${tweet.id}`,
    title: firstTextLine(tweet.text),
    body: tweet.text,
    author: author?.username ? `@${author.username}` : author?.name,
    publishedAt: tweet.created_at,
    tags: Array.from(new Set(["real-twitter", "x-search", ...matchedKeywords, tweet.lang].filter(Boolean) as string[])),
    metrics: {
      favorites: metrics.like_count ?? 0,
      retweets: (metrics.retweet_count ?? 0) + (metrics.quote_count ?? 0),
      replies: metrics.reply_count ?? 0,
      views: metrics.impression_count ?? 0
    },
    payload: {
      provider: "x-api",
      ...tweet,
      author,
      matchedKeywords,
      engagementScore: engagement,
      productDirection: input.productDirection
    }
  };
}

async function extractFromXApi(input: ConnectorInput): Promise<ExtractedRawItem[]> {
  const bearerToken = getXBearerToken();

  if (!bearerToken) {
    throw new Error("X_BEARER_TOKEN or TWITTER_BEARER_TOKEN is required for X/Twitter search");
  }

  const limit = input.limitPerSource ?? DEFAULT_LIMIT_PER_SOURCE;
  const maxPages = input.maxPages ?? DEFAULT_MAX_PAGES;
  const query = buildXSearchQuery(input).slice(0, 512);
  const results: ExtractedRawItem[] = [];
  const seenIds = new Set<string>();
  let nextToken: string | undefined;
  let pages = 0;

  console.log("[twitter-connector] x-api search start", {
    query,
    limit,
    maxPages
  });

  while (results.length < limit && pages < maxPages) {
    const remaining = limit - results.length;
    const pageSize = Math.min(100, Math.max(10, remaining));
    const url = new URL(xSearchUrl);
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", String(pageSize));
    url.searchParams.set("tweet.fields", "author_id,created_at,lang,public_metrics");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "name,username");

    if (nextToken) {
      url.searchParams.set("next_token", nextToken);
    }

    const response = await fetchOutbound(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`
      },
      next: {
        revalidate: 300
      }
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const apiError = new XApiHttpError(
        formatXApiAuthError(response.status),
        response.status,
        body.slice(0, 300)
      );
      logConnectorError("x-api http error", apiError, {
        status: response.status,
        statusText: response.statusText,
        page: pages + 1,
        query,
        bodyPreview: apiError.bodyPreview
      });
      throw apiError;
    }

    const payload = (await response.json()) as XSearchResponse;

    if (payload.errors?.length) {
      const apiError = new Error(payload.errors.map((error) => error.detail ?? error.title).filter(Boolean).join("; "));
      logConnectorError("x-api response error", apiError, {
        page: pages + 1,
        query,
        errors: payload.errors
      });
      throw apiError;
    }

    const usersById = new Map((payload.includes?.users ?? []).map((user) => [user.id, user]));
    const pageItems = (payload.data ?? [])
      .map((tweet) => mapXTweetToRawItem(tweet, usersById, input))
      .filter((item): item is ExtractedRawItem => Boolean(item))
      .filter((item) => {
        if (seenIds.has(item.externalId)) {
          return false;
        }

        seenIds.add(item.externalId);
        return true;
      });

    results.push(...pageItems);
    nextToken = payload.meta?.next_token;
    pages += 1;

    if (!nextToken || pageItems.length === 0) {
      break;
    }
  }

  console.log("[twitter-connector] x-api search completed", {
    query,
    pages,
    resultCount: results.length
  });

  return results
    .sort(
      (a, b) =>
        ((b.payload.engagementScore as number | undefined) ?? 0) - ((a.payload.engagementScore as number | undefined) ?? 0)
    )
    .slice(0, limit);
}

async function extractFromSopilot(input: ConnectorInput): Promise<ExtractedRawItem[]> {
  const limit = input.limitPerSource ?? DEFAULT_LIMIT_PER_SOURCE;
  const minResults = Math.min(limit, DEFAULT_SOPILOT_MIN_RESULTS);
  const tweets = await fetchSopilotHotTweets();
  const searchKeywords = expandSopilotKeywords(input);

  // 只在正文匹配关键词；作者 handle 不参与，避免 @xxxbtc 这类误命中。
  const keywordMatched = tweets
    .map((tweet) => {
      const matchedKeywords = prioritizeMatchedKeywords(
        findMatchedKeywords(tweet.body, searchKeywords),
        input.keywords
      );

      return {
        tweet,
        matchedKeywords
      };
    })
    .filter((entry) => entry.matchedKeywords.length > 0)
    .sort((a, b) => compareSopilotTweetHeat(b.tweet, a.tweet));

  const selected = keywordMatched.slice(0, limit);
  const selectedIds = new Set(selected.map((entry) => entry.tweet.externalId));

  // 关键词命中不足时，用当日 RSS 最热帖补足数量；标记 sopilot-hot-trend 供 enricher 区分。
  if (selected.length < minResults) {
    const hotFill = tweets
      .filter((tweet) => !selectedIds.has(tweet.externalId))
      .sort(compareSopilotTweetHeat)
      .slice(0, minResults - selected.length)
      .map((tweet) => ({
        tweet,
        matchedKeywords: ["sopilot-hot-trend"]
      }));

    selected.push(...hotFill);
  }

  console.log("[twitter-connector] sopilot rss scan completed", {
    rssItems: tweets.length,
    searchKeywords: searchKeywords.length,
    keywordMatched: keywordMatched.length,
    selectedCount: selected.length,
    minResults,
    limit
  });

  if (!selected.length) {
    throw new Error(`No X/Twitter posts matched keywords in SoPilot RSS: ${input.keywords.join(", ")}`);
  }

  return selected
    .slice(0, limit)
    .map(({ tweet, matchedKeywords }) => mapSopilotTweetToRawItem(tweet, matchedKeywords, input.productDirection));
}

export const twitterConnector: Connector = {
  source: "twitter",
  mode: "real",
  async extract(input: ConnectorInput): Promise<ExtractedRawItem[]> {
    // 优先官方 X API；401/402/403 或无 Token 时走 SoPilot RSS fallback。
    if (shouldUseOfficialXApi()) {
      try {
        return await extractFromXApi(input);
      } catch (error) {
        if (shouldFallbackFromXApi(error)) {
          console.warn("[twitter-connector] x-api unavailable, falling back to SoPilot keyword RSS", {
            errorType: error instanceof Error ? error.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
            status: error instanceof XApiHttpError ? error.status : null
          });
          return extractFromSopilot(input);
        }

        throw error;
      }
    }

    return extractFromSopilot(input);
  }
};
