import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectGrokToolEvidence } from "../grok-tool-evidence";

test("inspectGrokToolEvidence rejects thought-only payloads without tool results", () => {
  const evidence = inspectGrokToolEvidence({
    num_turns: 1,
    thought: "I will use x_keyword_search to find posts",
    text: '{"findings":[]}'
  });
  assert.equal(evidence.verified, false);
  assert.equal(evidence.reason, "x_search_not_executed");
});

test("inspectGrokToolEvidence accepts named tool call with a tool result", () => {
  const evidence = inspectGrokToolEvidence({
    num_turns: 2,
    events: [
      { type: "tool_call", name: "x_keyword_search", arguments: { query: "from:KillaXBT BTC" } },
      {
        type: "tool_result",
        tool_call_id: "call_1",
        content: [{ url: "https://x.com/KillaXBT/status/2079562686011220198" }]
      }
    ]
  });
  assert.equal(evidence.verified, true);
  assert.ok(evidence.toolNames.some((name) => /x_keyword_search/i.test(name)));
});
