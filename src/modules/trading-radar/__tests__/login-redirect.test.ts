import assert from "node:assert/strict";
import test from "node:test";
import { getSafeAuthRedirect } from "../../../lib/auth-redirect";

test("keeps local callback URLs", () => {
  assert.equal(
    getSafeAuthRedirect("/trading-radar?creator=killa#latest"),
    "/trading-radar?creator=killa#latest"
  );
});

test("falls back for external and malformed callback URLs", () => {
  for (const value of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "not-a-path",
    ["/trading-radar"]
  ]) {
    assert.equal(getSafeAuthRedirect(value), "/trading-radar");
  }
});
