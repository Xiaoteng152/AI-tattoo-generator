import type { EnrichmentResult } from "@/modules/enrichment/rule-based-enricher";
import type { NormalizedRecord } from "@/modules/normalization/normalize";

export type OpportunityDraft = {
  title: string;
  type: "seo-brief" | "content-angle" | "product-experiment";
  score: number;
  confidence: number;
  evidenceSummary: string;
  sourceUrls: string[];
  recommendedAct: string;
};

export function scoreOpportunity(item: NormalizedRecord, enrichment: EnrichmentResult): OpportunityDraft {
  const hasCommercialSignal = item.source === "etsy";
  const type = hasCommercialSignal ? "product-experiment" : "seo-brief";
  const score = Math.min(100, Math.round(enrichment.opportunityScore * 0.75 + item.engagementScore / 20));
  const confidence = Math.min(95, 55 + enrichment.painPoints.length * 10 + (hasCommercialSignal ? 15 : 5));
  const isTattooContext = /tattoo|纹身/i.test(`${item.title} ${item.body}`);
  const isCryptoContext = /比特币|以太坊|bitcoin|ethereum|crypto|加密|区块链|币圈|web3|btc|eth/i.test(
    `${item.title} ${item.body}`
  );

  return {
    title: item.title,
    type,
    score,
    confidence,
    evidenceSummary: enrichment.evidenceSummary,
    sourceUrls: [item.sourceUrl],
    recommendedAct: hasCommercialSignal
      ? "Validate a paid design-brief bundle and compare Etsy positioning."
      : isCryptoContext
        ? "Publish a trading-signal brief that explains the market narrative, risk framing, and a concrete next action."
        : isTattooContext
          ? "Publish an SEO brief that answers the tattoo-related concern in the X post with examples and a checklist."
          : "Publish an evidence-backed content brief that explains the signal, audience intent, and next growth action."
  };
}
