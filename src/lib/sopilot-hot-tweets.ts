import { createAuthFetch } from "@/lib/auth-fetch";

// SoPilot 公开 RSS：Workflow fallback 与 Dashboard「今日最热搜索」共用同一数据源。
const outboundFetch = createAuthFetch();
export const SOPILOT_HOT_TWEETS_URL = "https://sopilot.net/rss/hottweets";

export type SopilotTweet = {
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

export function parseSopilotRss(xml: string): SopilotTweet[] {
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
    // description 前半是正文，后半是 SoPilot 指标行；只把正文交给关键词匹配。
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

export function compareSopilotTweetHeat(a: SopilotTweet, b: SopilotTweet) {
  // 与 SoPilot 页面一致：爆火概率 > 浏览 > 互动。
  return (
    b.viralProbability - a.viralProbability ||
    b.views - a.views ||
    b.favorites - a.favorites ||
    b.reposts - a.reposts
  );
}

export function sortSopilotTweetsByHeat(tweets: SopilotTweet[]) {
  return [...tweets].sort(compareSopilotTweetHeat);
}

export function summarizeSopilotTweet(tweet: SopilotTweet) {
  return tweet.body.replace(/\s+/g, " ").trim().slice(0, 140);
}

export async function fetchSopilotHotTweets() {
  const response = await outboundFetch(process.env.SOPILOT_HOT_TWEETS_URL ?? SOPILOT_HOT_TWEETS_URL, {
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

  return parseSopilotRss(await response.text());
}

export async function getTopSopilotHotTweets(limit = 5) {
  const tweets = await fetchSopilotHotTweets();
  return sortSopilotTweetsByHeat(tweets).slice(0, limit);
}
