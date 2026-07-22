import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeXStatusTimestamp } from "../x-snowflake";

test("decodeXStatusTimestamp matches known X snowflake samples", () => {
  assert.equal(
    decodeXStatusTimestamp("2079562686011220198")?.toISOString(),
    "2026-07-21T13:42:35.408Z"
  );
  assert.equal(
    decodeXStatusTimestamp("2032435880990413008")?.toISOString(),
    "2026-03-13T12:37:29.517Z"
  );
});
