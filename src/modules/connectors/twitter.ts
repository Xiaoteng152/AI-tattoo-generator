import type { Connector, ConnectorInput, ExtractedRawItem } from "./types";

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
  includes?: {
    users?: XUser[];
  };
  errors?: Array<{
    title?: string;
    detail?: string;
  }>;
};

const xSearchUrl = "https://api.x.com/2/tweets/search/recent";
const sopilotHotTweetsUrl = "https://sopilot.net/rss/hottweets";

type SopilotTweet = {
  authorName: string;
  handle?: string;
  body: string;
  comments: number;
  externalId: string;
  favorites: number;
  publishedAt?: string;
  reposts: number;
  saves: number;
  sopilotUrl: string;
  sourceUrl: string;
  viralProbability: number;
  predictedViews: number;
  predictedCommentViews: number;
  views: number;
};

function getXBearerToken() {
  return process.env.X_BEARER_TOKEN ?? process.env.TWITTER_BEARER_TOKEN;
}

function quoteKeyword(keyword: string) {
  const trimmed = keyword.trim();
  return /\s/.test(trimmed) ? `"${trimmed.replaceAll('"', '\\"')}"` : trimmed;
}

function buildQuery(input: ConnectorInput) {
  const keywords = input.keywords.length ? input.keywords : [input.productDirection];
  const keywordQuery = keywords.slice(0, 5).map(quoteKeyword).join(" OR ");
  return `${keywordQuery} -is:retweet`;
}

function firstTextLine(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function readTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1].trim()) : "";
}

function numberAfter(description: string, pattern: RegExp) {
  const value = description.match(pattern)?.[1]?.replaceAll(",", "");
  return value ? Number(value) : 0;
}

function parseSopilotRss(xml: string): SopilotTweet[] {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return itemBlocks.map((block) => {
    const title = readTag(block, "title");
    const description = readTag(block, "description");
    const pubDate = readTag(block, "pubDate");
    const sopilotUrl = readTag(block, "link");
    const authorMatch = title.match(/^(.*?)\s*\(@([^)]+)\)$/);
    const sourceUrl = description.match(/原推链接:\s*(https:\/\/x\.com\/[^\s<]+)/)?.[1] ?? sopilotUrl;
    const externalId = sourceUrl.match(/status\/(\d+)/)?.[1] ?? sopilotUrl;
    const metricsLineStart = description.search(/\n[^\n]*\d+[^\n]*\n预测爆火概率:/);
    const body = metricsLineStart >= 0 ? description.slice(0, metricsLineStart).trim() : description;

    return {
      authorName: authorMatch?.[1]?.trim() || title,
      handle: authorMatch?.[2],
      body,
      comments: numberAfter(description, /💬\s*([\d,]+)/),
      externalId,
      favorites: numberAfter(description, /❤️\s*([\d,]+)/),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
      reposts: numberAfter(description, /🔁\s*([\d,]+)/),
      saves: numberAfter(description, /🔖\s*([\d,]+)/),
      sopilotUrl,
      sourceUrl,
      viralProbability: numberAfter(description, /预测爆火概率:(\d+)%/),
      predictedViews: numberAfter(description, /预测浏览量:(\d+)/),
      predictedCommentViews: numberAfter(description, /预测评论浏览量:(\d+)/),
      views: numberAfter(description, /👀\s*([\d,]+)/)
    };
  });
}

function matchesKeywords(tweet: SopilotTweet, keywords: string[]) {
  if (!keywords.length) {
    return true;
  }

  const haystack = `${tweet.authorName} ${tweet.handle ?? ""} ${tweet.body}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

async function extractFromSopilot(input: ConnectorInput): Promise<ExtractedRawItem[]> {
  const limit = input.limitPerSource ?? 8;
  const response = await fetch(process.env.SOPILOT_HOT_TWEETS_URL ?? sopilotHotTweetsUrl, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml"
    },
    next: {
      revalidate: 300
    }
  });

  if (!response.ok) {
    throw new Error(`SoPilot hot tweets RSS failed: ${response.status} ${response.statusText}`);
  }

  const tweets = parseSopilotRss(await response.text());
  const matchedTweets = tweets.filter((tweet) => matchesKeywords(tweet, input.keywords));
  const selectedTweets = (matchedTweets.length ? matchedTweets : tweets).slice(0, limit);

  return selectedTweets.map((tweet): ExtractedRawItem => ({
    source: "twitter",
    externalId: `sopilot-twitter-${tweet.externalId}`,
    sourceUrl: tweet.sourceUrl,
    title: firstTextLine(tweet.body),
    body: tweet.body,
    author: tweet.handle ? `@${tweet.handle}` : tweet.authorName,
    publishedAt: tweet.publishedAt,
    tags: Array.from(new Set(["sopilot-hot-tweet", "real-twitter", ...input.keywords])),
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
      matchedKeywords: input.keywords,
      productDirection: input.productDirection
    }
  }));
}

function shouldUseOfficialXApi() {
  return process.env.TWITTER_SOURCE === "x-api" || process.env.TWITTER_SOURCE === "official";
}

export const twitterConnector: Connector = {
  source: "twitter",
  mode: "real",
  async extract(input: ConnectorInput): Promise<ExtractedRawItem[]> {
    if (!shouldUseOfficialXApi()) {
      return extractFromSopilot(input);
    }

    const bearerToken = getXBearerToken();

    if (!bearerToken) {
      throw new Error("X_BEARER_TOKEN or TWITTER_BEARER_TOKEN is required for the real X/Twitter connector");
    }

    const limit = input.limitPerSource ?? 8;
    const requestLimit = Math.min(100, Math.max(10, limit));
    const url = new URL(xSearchUrl);
    url.searchParams.set("query", buildQuery(input).slice(0, 512));
    url.searchParams.set("max_results", String(requestLimit));
    url.searchParams.set("tweet.fields", "author_id,created_at,lang,public_metrics");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "name,username");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`
      },
      next: {
        revalidate: 300
      }
    });

    if (!response.ok) {
      throw new Error(`X/Twitter API failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as XSearchResponse;

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.detail ?? error.title).filter(Boolean).join("; "));
    }

    const usersById = new Map((payload.includes?.users ?? []).map((user) => [user.id, user]));

    return (payload.data ?? [])
      .filter((tweet) => tweet.id && tweet.text)
      .map((tweet): ExtractedRawItem => {
        const author = usersById.get(tweet.author_id);
        const metrics = tweet.public_metrics ?? {};

        return {
          source: "twitter",
          externalId: `twitter-${tweet.id}`,
          sourceUrl: author?.username ? `https://x.com/${author.username}/status/${tweet.id}` : `https://x.com/i/web/status/${tweet.id}`,
          title: firstTextLine(tweet.text ?? "Untitled X post"),
          body: tweet.text ?? "",
          author: author?.username ? `@${author.username}` : author?.name,
          publishedAt: tweet.created_at,
          tags: Array.from(
            new Set(
              ["real-twitter", ...(input.keywords.length ? input.keywords : [input.productDirection]), tweet.lang].filter(
                (tag): tag is string => Boolean(tag)
              )
            )
          ),
          metrics: {
            favorites: metrics.like_count ?? 0,
            retweets: (metrics.retweet_count ?? 0) + (metrics.quote_count ?? 0),
            replies: metrics.reply_count ?? 0,
            views: metrics.impression_count ?? 0
          },
          payload: {
            ...tweet,
            author,
            matchedKeywords: input.keywords,
            productDirection: input.productDirection
          }
        };
      })
      .sort(
        (a, b) =>
          (b.metrics.favorites ?? 0) + (b.metrics.retweets ?? 0) * 2 + (b.metrics.replies ?? 0) * 2 + (b.metrics.views ?? 0) / 1000 -
          ((a.metrics.favorites ?? 0) + (a.metrics.retweets ?? 0) * 2 + (a.metrics.replies ?? 0) * 2 + (a.metrics.views ?? 0) / 1000)
      )
      .slice(0, limit);
  }
};
