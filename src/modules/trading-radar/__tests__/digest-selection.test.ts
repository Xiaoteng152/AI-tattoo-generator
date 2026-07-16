import assert from "node:assert/strict";
import { test } from "node:test";
import { selectPostsForDigest } from "../digest-selection";

test("digest uses the latest ten unread posts from the selected creators", () => {
  const posts = Array.from({ length: 14 }, (_, index) => ({
    id: `post-${index}`,
    creatorId: index % 2 === 0 ? "creator-a" : "creator-b",
    publishedAt: new Date(`2026-07-15T${String(index).padStart(2, "0")}:00:00.000Z`),
    readAt: index === 13 ? new Date() : null
  }));

  const selected = selectPostsForDigest(posts, ["creator-a", "creator-b"]);

  assert.equal(selected.length, 10);
  assert.equal(selected[0].id, "post-12");
  assert.equal(selected.at(-1)?.id, "post-3");
});
