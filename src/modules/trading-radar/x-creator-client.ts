import { createAuthFetch } from "@/lib/auth-fetch";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type XPublicMetrics = {
  like_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  impression_count?: number;
};

type XTimelinePost = {
  id?: string;
  text?: string;
  created_at?: string;
  lang?: string;
  public_metrics?: XPublicMetrics;
  referenced_tweets?: Array<{ type?: string; id?: string }>;
};

export type CreatorTimelinePost = {
  externalId: string;
  sourceUrl: string;
  text: string;
  publishedAt: string;
  language: string;
  postType: "original" | "quote";
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
    views: number;
  };
  rawPayload: Record<string, unknown>;
};

export type ResolvedXCreator = {
  platformUserId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
};

type XCreatorTimelineClientOptions = {
  bearerToken: string;
  fetcher?: Fetcher;
};

function requireOk(response: Response, operation: string) {
  if (!response.ok) {
    throw new Error(`${operation} failed with X API status ${response.status}`);
  }
}

function mapTimelinePost(post: XTimelinePost, handle: string): CreatorTimelinePost | null {
  if (!post.id || !post.text || !post.created_at) {
    return null;
  }

  const isQuote = post.referenced_tweets?.some((reference) => reference.type === "quoted") ?? false;
  const metrics = post.public_metrics ?? {};

  return {
    externalId: post.id,
    sourceUrl: `https://x.com/${handle}/status/${post.id}`,
    text: post.text,
    publishedAt: post.created_at,
    language: post.lang ?? "und",
    postType: isQuote ? "quote" : "original",
    metrics: {
      likes: metrics.like_count ?? 0,
      reposts: metrics.retweet_count ?? 0,
      replies: metrics.reply_count ?? 0,
      quotes: metrics.quote_count ?? 0,
      views: metrics.impression_count ?? 0
    },
    rawPayload: post as Record<string, unknown>
  };
}

export function createXCreatorTimelineClient(options: XCreatorTimelineClientOptions) {
  const fetcher = options.fetcher ?? createAuthFetch();

  async function fetchJson(url: URL, operation: string) {
    const response = await fetcher(url, {
      headers: {
        Authorization: `Bearer ${options.bearerToken}`
      },
      cache: "no-store"
    });
    requireOk(response, operation);
    return (await response.json()) as Record<string, unknown>;
  }

  return {
    async resolveCreator(handle: string): Promise<ResolvedXCreator> {
      const url = new URL(`https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}`);
      url.searchParams.set("user.fields", "id,name,username,profile_image_url");
      const payload = await fetchJson(url, "Resolve creator");
      const data = payload.data as
        | { id?: string; name?: string; username?: string; profile_image_url?: string }
        | undefined;

      if (!data?.id || !data.username) {
        throw new Error(`X creator @${handle} was not found`);
      }

      return {
        platformUserId: data.id,
        handle: data.username.toLowerCase(),
        displayName: data.name ?? data.username,
        avatarUrl: data.profile_image_url
      };
    },

    async fetchLatest(input: {
      creatorId: string;
      handle: string;
      sinceId?: string;
      limit?: number;
    }): Promise<{ posts: CreatorTimelinePost[]; newestPostId?: string }> {
      const limit = Math.min(100, Math.max(5, input.limit ?? 10));
      const url = new URL(`https://api.x.com/2/users/${encodeURIComponent(input.creatorId)}/tweets`);
      url.searchParams.set("max_results", String(limit));
      url.searchParams.set("exclude", "replies,retweets");
      url.searchParams.set("tweet.fields", "created_at,lang,public_metrics,referenced_tweets");

      if (input.sinceId) {
        url.searchParams.set("since_id", input.sinceId);
      }

      const payload = await fetchJson(url, "Fetch creator timeline");
      const data = (payload.data as XTimelinePost[] | undefined) ?? [];
      const meta = payload.meta as { newest_id?: string } | undefined;
      const posts = data
        .map((post) => mapTimelinePost(post, input.handle))
        .filter((post): post is CreatorTimelinePost => Boolean(post));

      return {
        posts,
        newestPostId: meta?.newest_id ?? posts[0]?.externalId
      };
    }
  };
}
