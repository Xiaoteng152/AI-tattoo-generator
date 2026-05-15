import { getConnectors } from "@/modules/connectors";
import { enrichItem } from "@/modules/enrichment/enricher";
import { normalizeRawItem } from "@/modules/normalization/normalize";
import { scoreOpportunity } from "@/modules/scoring/opportunity-scorer";

export type BacktestInput = {
  productDirection?: string;
  keywords?: string[];
  limitPerSource?: number;
  lookbackDays?: number;
};

export async function runConnectorBacktest(input: BacktestInput = {}) {
  const productDirection = input.productDirection ?? "比特币增长机会";
  const keywords = input.keywords?.length ? input.keywords : ["比特币"];
  const allowMockFallback = /tattoo|纹身/i.test(`${productDirection} ${keywords.join(" ")}`);
  const connectors = getConnectors({ allowMockFallback });
  const startedAt = new Date();
  const sourceReports = [];
  const opportunities = [];

  for (const connector of connectors) {
    const sourceStartedAt = Date.now();

    try {
      const rawItems = await connector.extract({
        productDirection,
        keywords,
        limitPerSource: input.limitPerSource ?? 5,
        lookbackDays: input.lookbackDays ?? 30
      });

      const analyzed = [];

      for (const rawItem of rawItems) {
        const normalized = normalizeRawItem(rawItem);
        const enrichment = await enrichItem(normalized);
        const opportunity = scoreOpportunity(normalized, enrichment);
        analyzed.push({
          rawItem,
          normalized,
          enrichment,
          opportunity
        });
        opportunities.push({
          source: connector.source,
          title: opportunity.title,
          score: opportunity.score,
          confidence: opportunity.confidence,
          evidenceSummary: opportunity.evidenceSummary,
          sourceUrls: opportunity.sourceUrls
        });
      }

      sourceReports.push({
        source: connector.source,
        mode: connector.mode,
        ok: true,
        itemCount: rawItems.length,
        durationMs: Date.now() - sourceStartedAt,
        sampleTitles: rawItems.slice(0, 3).map((item) => item.title),
        analyzed
      });
    } catch (error) {
      sourceReports.push({
        source: connector.source,
        mode: connector.mode,
        ok: false,
        itemCount: 0,
        durationMs: Date.now() - sourceStartedAt,
        error: error instanceof Error ? error.message : "Unknown connector error",
        sampleTitles: [],
        analyzed: []
      });
    }
  }

  opportunities.sort((a, b) => b.score - a.score);

  return {
    productDirection,
    keywords,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    connectorMode: process.env.CONNECTORS_MODE ?? "hybrid",
    enrichmentMode: process.env.OPENAI_API_KEY ? process.env.OPENAI_MODEL ?? "openai-compatible" : "rules-fallback",
    summary: {
      sources: sourceReports.length,
      connectedSources: sourceReports.filter((source) => source.ok).length,
      totalItems: sourceReports.reduce((sum, source) => sum + source.itemCount, 0),
      opportunities: opportunities.length,
      topScore: opportunities[0]?.score ?? 0
    },
    sources: sourceReports,
    topOpportunities: opportunities.slice(0, 8)
  };
}
