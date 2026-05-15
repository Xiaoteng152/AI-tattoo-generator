import type { NormalizedRecord } from "@/modules/normalization/normalize";
import { enrichWithOpenAi } from "./openai-enricher";
import { enrichNormalizedItem, type EnrichmentResult } from "./rule-based-enricher";

export async function enrichItem(item: NormalizedRecord): Promise<EnrichmentResult> {
  if (process.env.ENRICHMENT_MODE === "rules") {
    return enrichNormalizedItem(item);
  }

  try {
    return await enrichWithOpenAi(item);
  } catch (error) {
    if (process.env.ENRICHMENT_STRICT === "true") {
      throw error;
    }

    return enrichNormalizedItem(item);
  }
}

export { enrichItem as enrichNormalizedItem };
