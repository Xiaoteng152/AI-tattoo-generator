/**
 * DeepSearch 领域类型：贯穿 query → plan → subagents → evidence → report 的数据契约。
 * 与 Growth Harness 的 NormalizedRecord / OpportunityDraft 对齐，便于后续转工作流任务。
 */
import type { SourceName } from "@/modules/connectors/types";
import type { EnrichmentResult } from "@/modules/enrichment/rule-based-enricher";
import type { NormalizedRecord } from "@/modules/normalization/normalize";
import type { OpportunityDraft } from "@/modules/scoring/opportunity-scorer";

/** 增长垂类：决定默认数据源、研究问题模板与报告侧重点 */
export type VerticalId =
  | "ai_tattoo_generator"
  | "ai_saas"
  | "cross_border_ecommerce"
  | "content_seo"
  | "community_kol";

export type DeepSearchSource =
  | SourceName
  | "pinterest"
  | "youtube"
  | "tiktok"
  | "seo"
  | "google_trends";

export type DeepSearchDepth = "quick" | "standard" | "deep";

export type DeepSearchIntent =
  | "pain_point"
  | "commercial"
  | "visual_trend"
  | "seo"
  | "content"
  | "creator_outreach";

export type AgentName =
  | "reddit_agent"
  | "visual_trend_agent"
  | "seo_agent"
  | "content_agent"
  | "kol_agent";

export type DeepSearchOutputType =
  | "seo_brief"
  | "short_video"
  | "pinterest_prompt"
  | "kol_outreach"
  | "markdown_report";

export type DeepSearchStatus =
  | "pending"
  | "planning"
  | "searching"
  | "analyzing"
  | "reporting"
  | "completed"
  | "failed";

/** 上下文预算：限制 L1 原始条目与 L2 证据进入 synthesis 的规模 */
export type ContextBudget = {
  maxRawItemsPerAgent: number;
  maxEvidencePerAgent: number;
  maxPlannerTokens: number;
  maxSynthesisTokens: number;
  maxFinalReportTokens: number;
};

export type ScoringRule = {
  id: string;
  weight: number;
  signal: string;
};

export type SearchQuestionTemplate = {
  id: string;
  question: string;
  intent: DeepSearchIntent;
  agent: AgentName;
  sourceTypes: DeepSearchSource[];
};

export type VerticalConfig = {
  id: VerticalId;
  name: string;
  defaultSources: DeepSearchSource[];
  seedKeywords: string[];
  searchQuestions: SearchQuestionTemplate[];
  scoringRules: ScoringRule[];
  reportTemplate: string;
  promptVersion: string;
};

/** Query Understanding Agent 输出：意图、垂类、市场与时间范围 */
export type QueryUnderstanding = {
  intent: "find_growth_opportunities" | "explore_topic" | "compare_options";
  vertical: VerticalId;
  targetMarket: string;
  timeRange: "last_7_days" | "last_30_days" | "last_90_days" | "any";
  keywords: string[];
  requiredSources: DeepSearchSource[];
  rationale: string;
};

export type DeepSearchQuestion = {
  id: string;
  question: string;
  intent: DeepSearchIntent;
  agent: AgentName;
  sources: DeepSearchSource[];
  queries: string[];
};

/** Research Planner 输出：可并发执行的研究问题与子 Agent 分配 */
export type DeepSearchPlan = {
  id: string;
  vertical: VerticalId;
  depth: DeepSearchDepth;
  goal: string;
  audience: string;
  seedKeywords: string[];
  questions: DeepSearchQuestion[];
  expectedOutputs: DeepSearchOutputType[];
  contextBudget: ContextBudget;
  promptVersion: string;
};

export type DeepSearchRunState = {
  runId: string;
  status: DeepSearchStatus;
  vertical: VerticalId;
  depth: DeepSearchDepth;
  goal: string;
  planId?: string;
  currentStep: string;
  questionsCompleted: number;
  questionsTotal: number;
  rawItemCount: number;
  evidenceCount: number;
  findingCount: number;
  evidenceBundleCount: number;
  opportunityCount: number;
  error?: string;
};

/** L2 结构化证据：每条必须可追溯至 source URL */
export type Evidence = {
  id: string;
  runId: string;
  questionId: string;
  agent: AgentName;
  sourceType: DeepSearchSource;
  title: string;
  url: string;
  snippet: string;
  metrics: Record<string, unknown>;
  publishedAt?: string;
  confidence: number;
};

export type AgentFinding = {
  id: string;
  runId: string;
  taskId: string;
  agent: AgentName;
  summary: string;
  evidence: Evidence[];
  gaps: string[];
  confidence: number;
};

export type EvidenceBundleSource = {
  source: DeepSearchSource;
  keyFindings: string[];
  representativeEvidence: Evidence[];
};

/** 按研究问题聚合的压缩证据包，供 Synthesis 生成机会卡 */
export type EvidenceBundle = {
  id: string;
  questionId: string;
  opportunityCandidate: string;
  sources: EvidenceBundleSource[];
  compressedSummary: string;
  confidence: number;
};

/** L1 原始观测：Connector 拉取后经 normalize/enrich，尚未裁剪进报告 */
export type DeepSearchObservation = {
  questionId: string;
  agent: AgentName;
  query: string;
  source: DeepSearchSource;
  rawItem: {
    externalId: string;
    sourceUrl: string;
    title: string;
    author?: string;
    snippet?: string;
    publishedAt?: string;
    metrics: Record<string, number | undefined>;
  };
  normalized?: NormalizedRecord;
  enrichment?: EnrichmentResult;
};

export type DeepSearchSourceProgress = {
  questionId: string;
  agent: AgentName;
  query: string;
  source: DeepSearchSource;
  ok: boolean;
  itemCount: number;
  durationMs: number;
  error?: string;
};

/** 增长机会卡：可一键转为 SEO brief、短视频选题等运营资产 */
export type OpportunityCard = {
  id: string;
  title: string;
  whyNow: string;
  audience: string;
  evidenceCount: number;
  confidence: number;
  score: number;
  growthActions: string[];
  priority: "high" | "medium" | "low";
  evidenceBundleIds: string[];
  sourceUrls: string[];
  draft: OpportunityDraft;
};

export type DeepSearchReport = {
  runId: string;
  vertical: VerticalId;
  depth: DeepSearchDepth;
  title: string;
  executiveSummary: string;
  whatIsTrending: string[];
  userPainPoints: string[];
  evidenceTable: Evidence[];
  topOpportunities: OpportunityCard[];
  recommendedActions: string[];
  risks: string[];
  nextSearchSuggestions: string[];
  citations: Evidence[];
};

export type DeepSearchResult = {
  state: DeepSearchRunState;
  understanding: QueryUnderstanding;
  plan: DeepSearchPlan;
  progress: DeepSearchSourceProgress[];
  findings: AgentFinding[];
  evidenceBundles: EvidenceBundle[];
  report: DeepSearchReport;
};

export type DeepSearchInput = {
  query?: string;
  goal?: string;
  audience?: string;
  vertical?: VerticalId;
  depth?: DeepSearchDepth;
  seedKeywords?: string[];
  targetMarket?: string;
  timeRange?: QueryUnderstanding["timeRange"];
  requiredSources?: DeepSearchSource[];
  limitPerSource?: number;
  lookbackDays?: number;
};
