import { NextResponse } from "next/server";
import { getTopSopilotHotTweets, summarizeSopilotTweet } from "@/lib/sopilot-hot-tweets";

export const runtime = "nodejs";

/** Dashboard「今日最热搜索」：只读 SoPilot RSS，不跑完整 workflow。 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(10, Math.max(1, Number(searchParams.get("limit") ?? 5)));

  try {
    const tweets = await getTopSopilotHotTweets(limit);

    return NextResponse.json({
      items: tweets.map((tweet) => ({
        author: tweet.handle ? `@${tweet.handle}` : tweet.authorName,
        authorName: tweet.authorName,
        body: summarizeSopilotTweet(tweet),
        sourceUrl: tweet.sourceUrl,
        viralProbability: tweet.viralProbability,
        views: tweet.views,
        favorites: tweet.favorites,
        publishedAt: tweet.publishedAt ?? null
      })),
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load hot tweets";
    return NextResponse.json({ error: message, items: [] }, { status: 503 });
  }
}
