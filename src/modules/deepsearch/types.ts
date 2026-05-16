import type { SourceName } from "@/modules/connectors/types";
import type { EnrichmentResult } from "@/modules/enrichment/rule-based-enricher";
import type { NormalizedRecord } from "@/modules/normalization/normalize";
import type { OpportunityDraft } from "@/modules/scoring/opportunity-scorer";

export type DeepSearchStatus = "pending" | "running" | "completed" | "failed";

export type DeepSearchIntent =
  | "pain_point"
  | "commercial"
  | "visual_trend"
  | "seo"
  | "content"
  | "creator_outreach";

export type DeepSearchSource = SourceName | "pinterest" | "google_trends";

export type DeepSearchOutputType = "seo_brief" | "short_video" | "pinterest_prompt" | "kol_outreach";

export type DeepSearchQuestion = {
  id: string;
  question: string;
  intent: DeepSearchIntent;
  sources: DeepSearchSource[];
  queries: string[];
};

export type DeepSearchPlan = {
  id: string;
  goal: string;
  audience: string;
  seedKeywords: string[];
  questions: DeepSearchQuestion[];
  expectedOutputs: DeepSearchOutputType[];
};

export type DeepSearchRunState = {
  runId: string;
  status: DeepSearchStatus;
  goal: string;
  planId?: string;
  currentStep: string;
  questionsCompleted: number;
  questionsTotal: number;
  rawItemCount: number;
  evidenceBundleCount: number;
  opportunityCount: number;
  error?: string;
};

export type DeepSearchEvidence = {
  rawItemId?: string;
  normalizedItemId?: string;
  title: string;
  url: string;
  metricSummary: string;
  whyItMatters: string;
};

export type EvidenceBundleSource = {
  source: DeepSearchSource;
  keyFindings: string[];
  representativeEvidence: DeepSearchEvidence[];
};

export type EvidenceBundle = {
  id: string;
  questionId: string;
  opportunityCandidate: string;
  sources: EvidenceBundleSource[];
  compressedSummary: string;
  confidence: number;
};

export type DeepSearchObservation = {
  questionId: string;
  query: string;
  source: SourceName;
  rawItem: {
    externalId: string;
    sourceUrl: string;
    title: string;
    author?: string;
    metrics: Record<string, number | undefined>;
  };
  normalized: NormalizedRecord;
  enrichment: EnrichmentResult;
};

export type DeepSearchSourceProgress = {
  questionId: string;
  query: string;
  source: DeepSearchSource;
  ok: boolean;
  itemCount: number;
  durationMs: number;
  error?: string;
};

export type DeepSearchOpportunity = {
  title: string;
  score: number;
  confidence: number;
  evidenceBundleIds: string[];
  recommendedActions: string[];
  sourceUrls: string[];
  draft: OpportunityDraft;
};

export type DeepSearchReport = {
  runId: string;
  title: string;
  summary: string;
  topOpportunities: DeepSearchOpportunity[];
  risks: string[];
  nextSearchSuggestions: string[];
};

export type DeepSearchResult = {
  state: DeepSearchRunState;
  plan: DeepSearchPlan;
  progress: DeepSearchSourceProgress[];
  evidenceBundles: EvidenceBundle[];
  report: DeepSearchReport;
};

export type DeepSearchInput = {
  goal?: string;
  audience?: string;
  seedKeywords?: string[];
  limitPerSource?: number;
  lookbackDays?: number;
};
