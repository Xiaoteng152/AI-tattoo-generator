import { strict as assert } from "node:assert";
import { test } from "node:test";
import { customFetch } from "@auth/core";
import {
  createGoogleProvider,
  GOOGLE_OAUTH_ENDPOINTS
} from "../google-auth-provider";

test("createGoogleProvider returns null when credentials are missing", () => {
  delete process.env.AUTH_GOOGLE_ID;
  delete process.env.AUTH_GOOGLE_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;

  assert.equal(createGoogleProvider(), null);
});

test("createGoogleProvider uses explicit Google OAuth endpoints", () => {
  process.env.AUTH_GOOGLE_ID = "test-client-id";
  process.env.AUTH_GOOGLE_SECRET = "test-client-secret";

  const provider = createGoogleProvider();
  assert.ok(provider);
  assert.ok(provider.options);
  assert.equal(provider.id, "google");
  assert.equal(
    provider.options.authorization?.url,
    GOOGLE_OAUTH_ENDPOINTS.authorization
  );
  assert.equal(provider.options.token?.url, GOOGLE_OAUTH_ENDPOINTS.token);
  assert.equal(
    provider.options.userinfo?.url,
    GOOGLE_OAUTH_ENDPOINTS.userinfo
  );
  assert.equal(typeof provider.options[customFetch], "function");
});
