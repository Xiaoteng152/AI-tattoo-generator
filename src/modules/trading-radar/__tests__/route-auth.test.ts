import assert from "node:assert/strict";
import { test } from "node:test";
import { hasValidCronSecret } from "../route-auth";

test("hasValidCronSecret accepts matching bearer token", () => {
  process.env.CRON_SECRET = "cron-test-secret";
  const request = new Request("http://localhost/api/trading-radar/sync", {
    headers: { authorization: "Bearer cron-test-secret" }
  });

  assert.equal(hasValidCronSecret(request), true);
});

test("hasValidCronSecret rejects missing or wrong secret", () => {
  process.env.CRON_SECRET = "cron-test-secret";
  const missing = new Request("http://localhost/api/trading-radar/sync");
  const wrong = new Request("http://localhost/api/trading-radar/sync", {
    headers: { authorization: "Bearer wrong-secret" }
  });

  assert.equal(hasValidCronSecret(missing), false);
  assert.equal(hasValidCronSecret(wrong), false);
});

test("hasValidCronSecret rejects when CRON_SECRET is unset", () => {
  delete process.env.CRON_SECRET;
  const request = new Request("http://localhost/api/trading-radar/sync", {
    headers: { authorization: "Bearer anything" }
  });

  assert.equal(hasValidCronSecret(request), false);
});
