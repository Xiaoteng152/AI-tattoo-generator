import assert from "node:assert/strict";
import { test } from "node:test";
import { createXCreatorTimelineClient } from "../x-creator-client";

test("creator timeline sync returns only new original and quote posts with a stable cursor", async () => {
  const requestedUrls: string[] = [];
  const client = createXCreatorTimelineClient({
    bearerToken: "test-token",
    fetcher: async (input) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "105",
              text: "BTC long after the 4H close above 68000",
              created_at: "2026-07-15T08:00:00.000Z",
              public_metrics: { like_count: 12 },
              referenced_tweets: []
            },
            {
              id: "104",
              text: "Watching ETH on a retest",
              created_at: "2026-07-15T07:00:00.000Z",
              public_metrics: { like_count: 8 },
              referenced_tweets: [{ type: "quoted", id: "90" }]
            }
          ],
          meta: { newest_id: "105", result_count: 2 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  });

  const result = await client.fetchLatest({
    creatorId: "42",
    handle: "killaxbt",
    sinceId: "100",
    limit: 10
  });

  assert.equal(result.newestPostId, "105");
  assert.deepEqual(result.posts.map((post) => post.postType), ["original", "quote"]);
  assert.deepEqual(result.posts.map((post) => post.sourceUrl), [
    "https://x.com/killaxbt/status/105",
    "https://x.com/killaxbt/status/104"
  ]);
  assert.match(requestedUrls[0], /since_id=100/);
  assert.match(requestedUrls[0], /exclude=replies%2Cretweets/);
});
