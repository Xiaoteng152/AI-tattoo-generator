import type { NormalizedRecord } from "@/modules/normalization/normalize";
import { enrichNormalizedItem, type EnrichmentResult } from "./rule-based-enricher";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const fallbackBaseUrl = "https://api.openai.com/v1";

function extractJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? content;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("AI response did not contain JSON");
  }

  return JSON.parse(raw.slice(start, end + 1)) as Partial<EnrichmentResult>;
}

function normalizeAiResult(result: Partial<EnrichmentResult>, item: NormalizedRecord): EnrichmentResult {
  const fallback = enrichNormalizedItem(item);

  return {
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    promptVersion: "ai-enrichment-v1",
    painPoints: result.painPoints?.length ? result.painPoints : fallback.painPoints,
    intent: result.intent ?? fallback.intent,
    trendType: result.trendType ?? fallback.trendType,
    keywords: result.keywords?.length ? result.keywords : fallback.keywords,
    contentAngles: result.contentAngles?.length ? result.contentAngles : fallback.contentAngles,
    evidenceSummary: result.evidenceSummary ?? fallback.evidenceSummary,
    opportunityScore:
      typeof result.opportunityScore === "number"
        ? Math.max(0, Math.min(100, Math.round(result.opportunityScore)))
        : fallback.opportunityScore
  };
}

export async function enrichWithOpenAi(item: NormalizedRecord): Promise<EnrichmentResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return enrichNormalizedItem(item);
  }

  const baseUrl = process.env.OPENAI_BASE_URL ?? fallbackBaseUrl;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a growth research analyst. Return only JSON with keys: painPoints, intent, trendType, keywords, contentAngles, evidenceSummary, opportunityScore."
        },
        {
          role: "user",
          content: JSON.stringify({
            source: item.source,
            title: item.title,
            body: item.body,
            tags: item.tags,
            engagementScore: item.engagementScore,
            sourceUrl: item.sourceUrl,
            task:
              "Analyze this evidence for an AI tattoo generator growth workflow. Score it for SEO/content/product opportunity from 0 to 100."
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible enrichment failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI-compatible enrichment returned empty content");
  }

  return normalizeAiResult(extractJson(content), item);
}
