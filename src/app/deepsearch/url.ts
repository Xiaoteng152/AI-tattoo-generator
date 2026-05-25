import { getVerticalConfig } from "@/modules/deepsearch/config/verticals";
import type { VerticalId } from "@/modules/deepsearch/types";

export const DEFAULT_DEEPSEARCH_QUERY =
  "Find growth opportunities for AI tattoo generator around fine line tattoo ideas";

export const DEFAULT_VERTICAL: VerticalId = "ai_tattoo_generator";
export const DEFAULT_DEPTH = "standard" as const;

export type DeepSearchDepth = "quick" | "standard" | "deep";

export type DeepSearchUrlInput = {
  query?: string;
  vertical?: VerticalId | "auto";
  depth?: DeepSearchDepth;
  keywords?: string[];
};

function keywordsMatchVerticalDefaults(
  keywords: string[],
  vertical: VerticalId | "auto"
): boolean {
  if (!keywords.length || vertical === "auto") {
    return keywords.length === 0;
  }

  const defaults = new Set(
    getVerticalConfig(vertical).seedKeywords.map((value) => value.trim().toLowerCase())
  );
  const normalized = keywords.map((value) => value.trim().toLowerCase()).filter(Boolean);

  return normalized.length > 0 && normalized.every((keyword) => defaults.has(keyword));
}

export function buildDeepSearchHref(input: DeepSearchUrlInput = {}): string {
  const params = new URLSearchParams();
  const query = input.query?.trim();
  const vertical = input.vertical ?? DEFAULT_VERTICAL;
  const depth = input.depth ?? DEFAULT_DEPTH;
  const keywords = input.keywords ?? [];

  if (query && query !== DEFAULT_DEEPSEARCH_QUERY) {
    params.set("q", query);
  }

  if (vertical !== "auto" && vertical !== DEFAULT_VERTICAL) {
    params.set("vertical", vertical);
  }

  if (depth !== DEFAULT_DEPTH) {
    params.set("depth", depth);
  }

  if (keywords.length && !keywordsMatchVerticalDefaults(keywords, vertical)) {
    params.set("k", keywords.join("|"));
  }

  const queryString = params.toString();
  return queryString ? `/deepsearch?${queryString}` : "/deepsearch";
}

export function parseKeywordsFromSearchParams(params: URLSearchParams): string {
  const compact = params.get("k")?.trim();
  if (compact) {
    return compact
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean)
      .join(", ");
  }

  return params.get("keywords")?.trim() ?? "";
}
