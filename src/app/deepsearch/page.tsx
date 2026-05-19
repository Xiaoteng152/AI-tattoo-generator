"use client";

/**
 * DeepSearch 调试页：按 pipeline 阶段展示 run state、理解、计划、进度、finding、bundle 与报告。
 */
import Link from "next/link";
import { useState } from "react";

type VerticalId =
  | "ai_tattoo_generator"
  | "ai_saas"
  | "cross_border_ecommerce"
  | "content_seo"
  | "community_kol";

type Depth = "quick" | "standard" | "deep";

type Evidence = {
  id: string;
  questionId: string;
  agent: string;
  sourceType: string;
  title: string;
  url: string;
  snippet: string;
  metrics: Record<string, unknown>;
  publishedAt?: string;
  confidence: number;
};

type AgentFinding = {
  id: string;
  taskId: string;
  agent: string;
  summary: string;
  evidence: Evidence[];
  gaps: string[];
  confidence: number;
};

type OpportunityCard = {
  id: string;
  title: string;
  whyNow: string;
  audience: string;
  evidenceCount: number;
  confidence: number;
  score: number;
  growthActions: string[];
  priority: "high" | "medium" | "low";
  sourceUrls: string[];
};

type DeepSearchResult = {
  state: {
    status: string;
    currentStep: string;
    vertical: VerticalId;
    depth: Depth;
    questionsCompleted: number;
    questionsTotal: number;
    rawItemCount: number;
    evidenceCount: number;
    findingCount: number;
    evidenceBundleCount: number;
    opportunityCount: number;
    error?: string;
  };
  understanding: {
    intent: string;
    vertical: VerticalId;
    targetMarket: string;
    timeRange: string;
    keywords: string[];
    requiredSources: string[];
    rationale: string;
  };
  plan: {
    id: string;
    vertical: VerticalId;
    depth: Depth;
    goal: string;
    audience: string;
    seedKeywords: string[];
    questions: Array<{
      id: string;
      question: string;
      intent: string;
      agent: string;
      sources: string[];
      queries: string[];
    }>;
    contextBudget: {
      maxRawItemsPerAgent: number;
      maxEvidencePerAgent: number;
      maxPlannerTokens: number;
      maxSynthesisTokens: number;
      maxFinalReportTokens: number;
    };
  };
  progress: Array<{
    questionId: string;
    agent: string;
    source: string;
    query: string;
    ok: boolean;
    itemCount: number;
    durationMs: number;
    error?: string;
  }>;
  findings: AgentFinding[];
  evidenceBundles: Array<{
    id: string;
    questionId: string;
    opportunityCandidate: string;
    compressedSummary: string;
    confidence: number;
    sources: Array<{
      source: string;
      keyFindings: string[];
      representativeEvidence: Evidence[];
    }>;
  }>;
  report: {
    title: string;
    executiveSummary: string;
    whatIsTrending: string[];
    userPainPoints: string[];
    recommendedActions: string[];
    risks: string[];
    nextSearchSuggestions: string[];
    topOpportunities: OpportunityCard[];
    citations: Evidence[];
  };
};

const verticalLabels: Record<VerticalId, string> = {
  ai_tattoo_generator: "AI tattoo generator",
  ai_saas: "AI SaaS",
  cross_border_ecommerce: "Cross-border ecommerce",
  content_seo: "Content SEO",
  community_kol: "Community / KOL"
};

const depthLabels: Record<Depth, string> = {
  quick: "Quick scan",
  standard: "Standard research",
  deep: "Deep research"
};

const defaultQuery = "Find growth opportunities for AI tattoo generator around fine line tattoo ideas";

export default function DeepSearchPage() {
  const [query, setQuery] = useState(defaultQuery);
  const [vertical, setVertical] = useState<VerticalId | "auto">("auto");
  const [depth, setDepth] = useState<Depth>("standard");
  const [keywords, setKeywords] = useState("");
  const [result, setResult] = useState<DeepSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runDeepSearch() {
    const seedKeywords = keywords
      .split(/[,，\n]/)
      .map((value) => value.trim())
      .filter(Boolean);

    setIsRunning(true);
    setError(null);
    setResult(null);

    const response = await fetch("/api/deepsearch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        vertical: vertical === "auto" ? undefined : vertical,
        depth,
        seedKeywords: seedKeywords.length ? seedKeywords : undefined,
        limitPerSource: depth === "deep" ? 5 : 3
      })
    });
    const payload = (await response.json().catch(() => null)) as
      | { result?: DeepSearchResult; error?: unknown }
      | null;

    setIsRunning(false);

    if (!response.ok || !payload?.result) {
      setError(
        typeof payload?.error === "string"
          ? payload.error
          : payload?.result?.state.error ?? "DeepSearch run failed"
      );
      return;
    }

    setResult(payload.result);
  }

  return (
    <main className="deepsearch-page">
      <section className="deepsearch-hero">
        <Link className="back-link" href="/">
          返回 Dashboard
        </Link>
        <div>
          <span className="hot-badge">DeepSearch Agent · v2</span>
          <h1 className="title">垂类感知的可追溯增长研究</h1>
          <p className="lead">
            按 DEEPSEARCH.md：先由 Query Understanding 识别垂类，再交给 Vertical Router 调度子 Agent，
            最后压缩证据并生成 Opportunity Card。所有 Prompt、垂类、上下文预算都以配置形式管理。
          </p>
        </div>
        <div className="deepsearch-controls">
          <label className="backtest-field">
            <span>研究问题</span>
            <input
              disabled={isRunning}
              onChange={(event) => setQuery(event.target.value)}
              value={query}
            />
          </label>
          <label className="backtest-field">
            <span>垂类</span>
            <select
              disabled={isRunning}
              onChange={(event) => setVertical(event.target.value as VerticalId | "auto")}
              value={vertical}
            >
              <option value="auto">Auto (route from query)</option>
              {(
                Object.keys(verticalLabels) as VerticalId[]
              ).map((id) => (
                <option key={id} value={id}>
                  {verticalLabels[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="backtest-field">
            <span>深度</span>
            <select
              disabled={isRunning}
              onChange={(event) => setDepth(event.target.value as Depth)}
              value={depth}
            >
              <option value="quick">{depthLabels.quick}</option>
              <option value="standard">{depthLabels.standard}</option>
              <option value="deep">{depthLabels.deep}</option>
            </select>
          </label>
          <label className="backtest-field">
            <span>种子关键词 (可选)</span>
            <input
              disabled={isRunning}
              onChange={(event) => setKeywords(event.target.value)}
              value={keywords}
              placeholder="ai tattoo, fine line tattoo"
            />
          </label>
          <button
            className="ghost-button"
            disabled={isRunning || !query.trim()}
            onClick={runDeepSearch}
            type="button"
          >
            {isRunning ? "DeepSearch 正在运行..." : "运行 DeepSearch Agent"}
          </button>
          {error ? <p className="warning">{error}</p> : null}
        </div>
      </section>

      {result ? (
        <section className="deepsearch-grid">
          {/* 按 DEEPSEARCH pipeline 顺序展示各阶段产物 */}
          <article className="deepsearch-card">
            <h2>Run State</h2>
            <div className="deepsearch-stats">
              <strong>{result.state.status}</strong>
              <span>vertical: {verticalLabels[result.state.vertical] ?? result.state.vertical}</span>
              <span>depth: {depthLabels[result.state.depth] ?? result.state.depth}</span>
              <span>{result.state.currentStep}</span>
              <span>
                {result.state.questionsCompleted}/{result.state.questionsTotal} questions
              </span>
              <span>{result.state.rawItemCount} raw items</span>
              <span>{result.state.findingCount} findings</span>
              <span>{result.state.evidenceCount} evidence</span>
              <span>{result.state.evidenceBundleCount} bundles</span>
              <span>{result.state.opportunityCount} opportunities</span>
            </div>
          </article>

          <article className="deepsearch-card">
            <h2>Query Understanding</h2>
            <div className="question-list">
              <div className="question-row">
                <span>vertical</span>
                <strong>{verticalLabels[result.understanding.vertical] ?? result.understanding.vertical}</strong>
                <small>{result.understanding.rationale}</small>
              </div>
              <div className="question-row">
                <span>market</span>
                <strong>{result.understanding.targetMarket}</strong>
                <small>{result.understanding.timeRange}</small>
              </div>
              <div className="question-row">
                <span>sources</span>
                <strong>{result.understanding.requiredSources.join(" / ")}</strong>
                <small>{result.understanding.keywords.join(", ")}</small>
              </div>
            </div>
          </article>

          <article className="deepsearch-card">
            <h2>Plan</h2>
            <p className="muted">
              budget: raw≤{result.plan.contextBudget.maxRawItemsPerAgent} / evidence≤
              {result.plan.contextBudget.maxEvidencePerAgent} per agent
            </p>
            <div className="question-list">
              {result.plan.questions.map((question) => (
                <div className="question-row" key={question.id}>
                  <span>{question.intent}</span>
                  <strong>{question.question}</strong>
                  <small>
                    {question.agent} · {question.sources.join(" / ")}
                  </small>
                </div>
              ))}
            </div>
          </article>

          <article className="deepsearch-card">
            <h2>Source Progress</h2>
            <div className="question-list">
              {result.progress.map((progress, index) => (
                <div
                  className="question-row"
                  key={`${progress.questionId}-${progress.source}-${progress.query}-${index}`}
                >
                  <span>{progress.ok ? "OK" : "FAIL"}</span>
                  <strong>
                    {progress.agent} · {progress.source} · {progress.itemCount} items · {progress.durationMs}ms
                  </strong>
                  <small>{progress.error ?? progress.query}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="deepsearch-card wide">
            <h2>Agent Findings</h2>
            <div className="bundle-list">
              {result.findings.map((finding) => (
                <section className="bundle-card" key={finding.id}>
                  <div>
                    <span>
                      {finding.agent} · confidence {(finding.confidence * 100).toFixed(0)}%
                    </span>
                    <h3>{finding.summary}</h3>
                    {finding.gaps.length ? (
                      <p className="muted">Gaps: {finding.gaps.join("; ")}</p>
                    ) : null}
                  </div>
                  {finding.evidence.slice(0, 3).map((evidence) => (
                    <a
                      href={evidence.url}
                      key={evidence.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      [{evidence.sourceType}] {evidence.title}
                    </a>
                  ))}
                </section>
              ))}
            </div>
          </article>

          <article className="deepsearch-card wide">
            <h2>Evidence Bundles</h2>
            <div className="bundle-list">
              {result.evidenceBundles.map((bundle) => (
                <section className="bundle-card" key={bundle.id}>
                  <div>
                    <span>confidence {bundle.confidence}%</span>
                    <h3>{bundle.opportunityCandidate}</h3>
                    <p>{bundle.compressedSummary}</p>
                  </div>
                  {bundle.sources.flatMap((source) =>
                    source.representativeEvidence.slice(0, 2).map((evidence) => (
                      <a href={evidence.url} key={evidence.id} rel="noreferrer" target="_blank">
                        {source.source}: {evidence.title}
                      </a>
                    ))
                  )}
                </section>
              ))}
            </div>
          </article>

          <article className="deepsearch-card wide">
            <h2>Opportunity Cards</h2>
            <p>{result.report.executiveSummary}</p>
            <div className="opportunity-list">
              {result.report.topOpportunities.map((opportunity) => (
                <section className="opportunity-card" key={opportunity.id}>
                  <div>
                    <span>
                      priority {opportunity.priority} · score {opportunity.score}% · confidence
                      {" "}
                      {opportunity.confidence}% · evidence {opportunity.evidenceCount}
                    </span>
                    <h3>{opportunity.title}</h3>
                    <p>
                      <strong>Why now:</strong> {opportunity.whyNow}
                    </p>
                    <p>
                      <strong>Audience:</strong> {opportunity.audience}
                    </p>
                  </div>
                  <ul>
                    {opportunity.growthActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                  {opportunity.sourceUrls.slice(0, 3).map((url) => (
                    <a href={url} key={url} rel="noreferrer" target="_blank">
                      {url}
                    </a>
                  ))}
                </section>
              ))}
            </div>
          </article>

          <article className="deepsearch-card wide">
            <h2>Report Sections</h2>
            <h3>What is trending</h3>
            <ul>
              {result.report.whatIsTrending.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
            <h3>User pain points</h3>
            <ul>
              {result.report.userPainPoints.map((value, index) => (
                <li key={`${value}-${index}`}>{value}</li>
              ))}
            </ul>
            <h3>Recommended actions</h3>
            <ul>
              {result.report.recommendedActions.map((value, index) => (
                <li key={`${value}-${index}`}>{value}</li>
              ))}
            </ul>
            <h3>Risks and uncertainty</h3>
            <ul>
              {result.report.risks.map((value, index) => (
                <li key={`${value}-${index}`}>{value}</li>
              ))}
            </ul>
            <h3>Next search suggestions</h3>
            <ul>
              {result.report.nextSearchSuggestions.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}
    </main>
  );
}
