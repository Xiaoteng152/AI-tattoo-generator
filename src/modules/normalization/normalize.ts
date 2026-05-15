import type { ExtractedRawItem } from "@/modules/connectors/types";

export type NormalizedRecord = {
  source: string;
  title: string;
  body: string;
  author?: string;
  sourceUrl: string;
  tags: string[];
  language: string;
  engagementScore: number;
};

export function normalizeRawItem(item: ExtractedRawItem): NormalizedRecord {
  const engagementScore =
    (item.metrics.upvotes ?? 0) +
    (item.metrics.comments ?? 0) * 2 +
    (item.metrics.favorites ?? 0) +
    (item.metrics.retweets ?? 0) * 2 +
    (item.metrics.replies ?? 0) * 2 +
    Math.round((item.metrics.views ?? 0) / 1000) +
    (item.metrics.salesSignal ?? 0) * 3 +
    (item.metrics.saves ?? 0);

  return {
    source: item.source,
    title: item.title.trim(),
    body: item.body.trim(),
    author: item.author,
    sourceUrl: item.sourceUrl,
    tags: Array.from(new Set(item.tags)),
    language: "en",
    engagementScore
  };
}
