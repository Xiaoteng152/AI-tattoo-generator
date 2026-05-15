import type { Connector, ConnectorInput, ExtractedRawItem } from "./types";

type RedditChild = {
  data?: {
    id?: string;
    permalink?: string;
    url?: string;
    title?: string;
    selftext?: string;
    author?: string;
    subreddit?: string;
    ups?: number;
    num_comments?: number;
    created_utc?: number;
    link_flair_text?: string | null;
  };
};

type RedditSearchResponse = {
  data?: {
    children?: RedditChild[];
  };
};

const redditBaseUrl = "https://www.reddit.com";

function buildTags(post: NonNullable<RedditChild["data"]>, keyword: string) {
  return Array.from(
    new Set(["real-reddit", keyword, post.subreddit ? `r/${post.subreddit}` : undefined, post.link_flair_text ?? undefined].filter(Boolean))
  ) as string[];
}

export const redditConnector: Connector = {
  source: "reddit",
  mode: "real",
  async extract(input: ConnectorInput): Promise<ExtractedRawItem[]> {
    const limit = input.limitPerSource ?? 8;
    const perKeywordLimit = Math.max(3, Math.ceil(limit / Math.max(input.keywords.length, 1)));
    const results: ExtractedRawItem[] = [];

    for (const keyword of input.keywords) {
      const url = new URL("/search.json", redditBaseUrl);
      url.searchParams.set("q", keyword);
      url.searchParams.set("sort", "relevance");
      url.searchParams.set("t", input.lookbackDays && input.lookbackDays <= 7 ? "week" : "month");
      url.searchParams.set("limit", String(perKeywordLimit));

      const response = await fetch(url, {
        headers: {
          "User-Agent": "AutomnicTT/0.1 growth research contact=local-mvp"
        },
        next: {
          revalidate: 300
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API failed: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as RedditSearchResponse;
      const children = payload.data?.children ?? [];

      for (const child of children) {
        const post = child.data;
        if (!post?.id || !post.title) {
          continue;
        }

        results.push({
          source: "reddit",
          externalId: `reddit-${post.id}`,
          sourceUrl: post.permalink ? `${redditBaseUrl}${post.permalink}` : (post.url ?? redditBaseUrl),
          title: post.title,
          body: post.selftext ?? "",
          author: post.author,
          publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : undefined,
          tags: buildTags(post, keyword),
          metrics: {
            upvotes: post.ups ?? 0,
            comments: post.num_comments ?? 0
          },
          payload: {
            ...post,
            matchedKeyword: keyword,
            productDirection: input.productDirection
          }
        });
      }
    }

    const unique = new Map(results.map((item) => [item.externalId, item]));
    return Array.from(unique.values())
      .sort((a, b) => (b.metrics.upvotes ?? 0) + (b.metrics.comments ?? 0) - ((a.metrics.upvotes ?? 0) + (a.metrics.comments ?? 0)))
      .slice(0, limit);
  }
};
