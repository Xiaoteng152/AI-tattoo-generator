const TOOL_NAME_RE = /(x[_-]?search|x[_-]?keyword[_-]?search|x_keyword_search)/i;

export type GrokToolEvidence = {
  verified: boolean;
  toolNames: string[];
  reason: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function collectToolNames(node: unknown, names: Set<string>, depth = 0) {
  if (depth > 12 || node == null) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectToolNames(item, names, depth + 1);
    }
    return;
  }

  const record = asRecord(node);
  if (!record) {
    return;
  }

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && /(name|tool)/i.test(key) && TOOL_NAME_RE.test(value)) {
      names.add(value);
    }
    if (key === "name" && typeof value === "string" && TOOL_NAME_RE.test(value)) {
      names.add(value);
    }
    collectToolNames(value, names, depth + 1);
  }
}

function hasToolResultSignal(node: unknown, depth = 0): boolean {
  if (depth > 12 || node == null) {
    return false;
  }

  if (Array.isArray(node)) {
    return node.some((item) => hasToolResultSignal(item, depth + 1));
  }

  const record = asRecord(node);
  if (!record) {
    return false;
  }

  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  if (
    type.includes("tool_result") ||
    type.includes("tool-result") ||
    type.includes("function_call_output") ||
    type === "tool"
  ) {
    return true;
  }

  if ("tool_call_id" in record || "toolCallId" in record) {
    return true;
  }

  if (Array.isArray(record.tool_results) && record.tool_results.length > 0) {
    return true;
  }

  return Object.values(record).some((value) => hasToolResultSignal(value, depth + 1));
}

/**
 * Require evidence that an X search tool actually ran.
 * Model prose like "I will use x_keyword_search" is not enough.
 */
export function inspectGrokToolEvidence(raw: unknown): GrokToolEvidence {
  const names = new Set<string>();
  collectToolNames(raw, names);
  const toolNames = [...names];
  const hasResult = hasToolResultSignal(raw);

  if (toolNames.length > 0 && hasResult) {
    return { verified: true, toolNames, reason: null };
  }

  if (toolNames.length > 0 && !hasResult) {
    return {
      verified: false,
      toolNames,
      reason: "x_search_tool_named_without_result"
    };
  }

  return {
    verified: false,
    toolNames,
    reason: "x_search_not_executed"
  };
}

export function assertGrokToolEvidence(raw: unknown): GrokToolEvidence {
  const evidence = inspectGrokToolEvidence(raw);
  if (!evidence.verified) {
    throw new Error(evidence.reason ?? "x_search_not_executed");
  }
  return evidence;
}
