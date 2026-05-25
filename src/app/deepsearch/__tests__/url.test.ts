import assert from "node:assert/strict";
import test from "node:test";
import { buildDeepSearchHref, parseKeywordsFromSearchParams } from "../url";

test("buildDeepSearchHref omits default vertical, depth and seed keywords", () => {
  assert.equal(
    buildDeepSearchHref({
      vertical: "ai_tattoo_generator",
      depth: "standard",
      keywords: [
        "ai tattoo",
        "tattoo generator",
        "minimal tattoo",
        "fine line tattoo",
        "tattoo ideas"
      ]
    }),
    "/deepsearch"
  );
});

test("buildDeepSearchHref keeps only non-default params", () => {
  assert.equal(
    buildDeepSearchHref({
      query: "Validate: Fine-line tattoo aging anxiety",
      depth: "deep"
    }),
    "/deepsearch?q=Validate%3A+Fine-line+tattoo+aging+anxiety&depth=deep"
  );
});

test("buildDeepSearchHref uses compact keyword param for custom seeds", () => {
  assert.equal(
    buildDeepSearchHref({
      keywords: ["coverup", "stencil export"]
    }),
    "/deepsearch?k=coverup%7Cstencil+export"
  );
});

test("parseKeywordsFromSearchParams supports compact and legacy formats", () => {
  assert.equal(
    parseKeywordsFromSearchParams(
      new URLSearchParams("k=ai+tattoo|fine+line+tattoo")
    ),
    "ai tattoo, fine line tattoo"
  );
  assert.equal(
    parseKeywordsFromSearchParams(
      new URLSearchParams("keywords=ai tattoo, tattoo generator")
    ),
    "ai tattoo, tattoo generator"
  );
});
