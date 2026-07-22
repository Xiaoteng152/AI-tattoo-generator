import assert from "node:assert/strict";
import { test } from "node:test";
import { parseXCreatorHandle } from "../creator-handle";

test("user can add the same X creator by handle or profile URL", () => {
  assert.equal(parseXCreatorHandle("@KillaXBT"), "killaxbt");
  assert.equal(parseXCreatorHandle("https://x.com/KillaXBT/"), "killaxbt");
  assert.equal(parseXCreatorHandle("twitter.com/KillaXBT"), "killaxbt");
});

test("parseXCreatorInput keeps display casing", async () => {
  const { parseXCreatorInput } = await import("../creator-handle");
  assert.deepEqual(parseXCreatorInput("@KillaXBT"), {
    handle: "killaxbt",
    displayHandle: "KillaXBT"
  });
});

test("user cannot add non-profile URLs as creators", () => {
  assert.throws(() => parseXCreatorHandle("https://x.com/KillaXBT/status/123"), /profile/i);
  assert.throws(() => parseXCreatorHandle("https://example.com/KillaXBT"), /profile/i);
  assert.throws(() => parseXCreatorHandle("@bad-handle"), /handle/i);
});
