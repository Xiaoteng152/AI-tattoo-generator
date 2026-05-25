"use client";

/**
 * DeepSearch 运营页：Editorial Command Center 布局，保留完整 pipeline 数据绑定。
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteNav } from "../components/SiteNav";
import {
  DEFAULT_DEEPSEARCH_QUERY,
  parseKeywordsFromSearchParams
} from "./url";

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

type TimelineStatus = "ok" | "fail" | "pending";

type TimelineStep = {
  id: string;
  title: string;
  detail: string;
  status: TimelineStatus;
  pill: string;
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

const priorityLabels: Record<OpportunityCard["priority"], string> = {
  high: "high",
  medium: "med",
  low: "low"
};

const defaultQuery = DEFAULT_DEEPSEARCH_QUERY;

const navItems = [
  { id: "ds-query", label: "Query" },
  { id: "ds-plan", label: "Plan" },
  { id: "ds-evidence", label: "Evidence" },
  { id: "ds-report", label: "Report" }
] as const;

function isVerticalId(value: string | null): value is VerticalId {
  return value !== null && Object.prototype.hasOwnProperty.call(verticalLabels, value);
}

function isDepth(value: string | null): value is Depth {
  return value === "quick" || value === "standard" || value === "deep";
}

function readUrlDefaults(): {
  query: string;
  vertical: VerticalId | "auto";
  depth: Depth;
  keywords: string;
} {
  if (typeof window === "undefined") {
    return {
      query: defaultQuery,
      vertical: "auto",
      depth: "standard",
      keywords: ""
    };
  }

  const params = new URLSearchParams(window.location.search);
  const verticalParam = params.get("vertical");
  const depthParam = params.get("depth");

  return {
    query: params.get("q")?.trim() || defaultQuery,
    vertical: isVerticalId(verticalParam)
      ? verticalParam
      : verticalParam === "auto"
        ? "auto"
        : "auto",
    depth: isDepth(depthParam) ? depthParam : "standard",
    keywords: parseKeywordsFromSearchParams(params)
  };
}

function buildTimeline(result: DeepSearchResult | null, isRunning: boolean): TimelineStep[] {
  if (isRunning) {
    return [
      {
        id: "understanding",
        title: "Query Understanding",
        detail: "Routing vertical and required sources…",
        status: "pending",
        pill: "…"
      },
      {
        id: "plan",
        title: "Research Plan",
        detail: "Questions, sources, context budget",
        status: "pending",
        pill: "…"
      },
      {
        id: "progress",
        title: "Source Collection",
        detail: "Sub-agents fetching normalized signals",
        status: "pending",
        pill: "…"
      },
      {
        id: "findings",
        title: "Agent Findings",
        detail: "Per-agent summaries with citations",
        status: "pending",
        pill: "…"
      },
      {
        id: "bundles",
        title: "Evidence Bundles",
        detail: "Compressed claims with citations",
        status: "pending",
        pill: "…"
      },
      {
        id: "opportunities",
        title: "Opportunity Cards",
        detail: "Evidence-ranked growth actions",
        status: "pending",
        pill: "…"
      }
    ];
  }

  if (!result) {
    return [
      {
        id: "understanding",
        title: "Query Understanding",
        detail: "Route to vertical from natural-language query",
        status: "pending",
        pill: "—"
      },
      {
        id: "plan",
        title: "Research Plan",
        detail: "Questions, sources, context budget",
        status: "pending",
        pill: "—"
      },
      {
        id: "bundles",
        title: "Evidence Bundles",
        detail: "Compressed claims with citations",
        status: "pending",
        pill: "—"
      }
    ];
  }

  const progressFailed = result.progress.some((row) => !row.ok);
  const progressOk = result.progress.length > 0 && !progressFailed;

  return [
    {
      id: "understanding",
      title: "Query Understanding",
      detail: `route to ${verticalLabels[result.understanding.vertical] ?? result.understanding.vertical} · ${result.understanding.intent}`,
      status: "ok",
      pill: "OK"
    },
    {
      id: "plan",
      title: "Research Plan",
      detail: `${result.plan.questions.length} questions · budget raw≤${result.plan.contextBudget.maxRawItemsPerAgent}`,
      status: "ok",
      pill: "OK"
    },
    {
      id: "progress",
      title: "Source Collection",
      detail: `${result.progress.filter((row) => row.ok).length}/${result.progress.length} source runs · ${result.state.rawItemCount} raw items`,
      status: progressFailed ? "fail" : progressOk ? "ok" : "pending",
      pill: progressFailed ? "FAIL" : progressOk ? "OK" : "—"
    },
    {
      id: "findings",
      title: "Agent Findings",
      detail: `${result.findings.length} agent summaries · avg confidence ${Math.round(
        (result.findings.reduce((sum, finding) => sum + finding.confidence, 0) /
          Math.max(result.findings.length, 1)) *
          100
      )}%`,
      status: result.findings.length ? "ok" : "pending",
      pill: result.findings.length ? "OK" : "—"
    },
    {
      id: "bundles",
      title: "Evidence Bundles",
      detail: `${result.evidenceBundles.length} compressed bundles · ${result.state.evidenceCount} evidence`,
      status: result.evidenceBundles.length ? "ok" : "pending",
      pill: result.evidenceBundles.length ? "OK" : "—"
    },
    {
      id: "opportunities",
      title: "Opportunity Cards",
      detail: `${result.report.topOpportunities.length} ranked opportunities`,
      status: result.report.topOpportunities.length ? "ok" : "pending",
      pill: result.report.topOpportunities.length ? "OK" : "—"
    }
  ];
}

function buildReportBrief(result: DeepSearchResult): string {
  const lines: string[] = [
    `# ${result.report.title}`,
    "",
    result.report.executiveSummary,
    "",
    "## Trending",
    ...result.report.whatIsTrending.map((item) => `- ${item}`),
    "",
    "## Pain points",
    ...result.report.userPainPoints.map((item) => `- ${item}`),
    "",
    "## Recommended actions",
    ...result.report.recommendedActions.map((item) => `- ${item}`),
    "",
    "## Risks",
    ...result.report.risks.map((item) => `- ${item}`),
    "",
    "## Next search suggestions",
    ...result.report.nextSearchSuggestions.map((item) => `- ${item}`)
  ];

  return lines.join("\n");
}

export function DeepSearchView() {
  const [urlDefaults] = useState(readUrlDefaults);
  const [query, setQuery] = useState(urlDefaults.query);
  const [vertical, setVertical] = useState<VerticalId | "auto">(urlDefaults.vertical);
  const [depth, setDepth] = useState<Depth>(urlDefaults.depth);
  const [keywords, setKeywords] = useState(urlDefaults.keywords);
  const [result, setResult] = useState<DeepSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeNav, setActiveNav] = useState<(typeof navItems)[number]["id"]>("ds-query");

  const timeline = useMemo(
    () => buildTimeline(result, isRunning),
    [result, isRunning]
  );

  async function runDeepSearch() {
    const seedKeywords = keywords
      .split(/[,，\n]/)
      .map((value) => value.trim())
      .filter(Boolean);

    setIsRunning(true);
    setError(null);
    setResult(null);
    setActiveNav("ds-plan");

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
      setActiveNav("ds-query");
      return;
    }

    setResult(payload.result);
    setActiveNav("ds-report");
  }

  function handleNavClick(sectionId: (typeof navItems)[number]["id"]) {
    setActiveNav(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const opportunities = result?.report.topOpportunities ?? [];

  return (
    <main className="ds-page">
      <div className="ds-frame">
        <header className="ds-top">
          <Link className="ds-logo" href="/">
            <span aria-hidden className="ds-logo-dot" />
            Automnic TT
          </Link>
          <div className="ds-top-end">
            <SiteNav active="deepsearch" />
          </div>
        </header>

        <div className="ds-subtop">
          <nav aria-label="DeepSearch sections" className="ds-nav">
            {navItems.map((item) => (
              <a
                key={item.id}
                className={activeNav === item.id ? "is-active" : undefined}
                href={`#${item.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  handleNavClick(item.id);
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="ds-body">
          <div className="ds-deep-grid">
            <aside className="ds-panel ds-control-panel" id="ds-query">
              <p className="ds-small-label">Research Input</p>
              <div className="ds-input-stack">
                <label className="ds-field">
                  <span>研究问题</span>
                  <textarea
                    disabled={isRunning}
                    onChange={(event) => setQuery(event.target.value)}
                    value={query}
                  />
                </label>
                <label className="ds-field">
                  <span>垂类</span>
                  <select
                    disabled={isRunning}
                    onChange={(event) => setVertical(event.target.value as VerticalId | "auto")}
                    value={vertical}
                  >
                    <option value="auto">Auto (route from query)</option>
                    {(Object.keys(verticalLabels) as VerticalId[]).map((id) => (
                      <option key={id} value={id}>
                        {verticalLabels[id]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ds-field">
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
                <label className="ds-field">
                  <span>种子关键词 (可选)</span>
                  <input
                    disabled={isRunning}
                    onChange={(event) => setKeywords(event.target.value)}
                    placeholder="ai tattoo, fine line tattoo"
                    value={keywords}
                  />
                </label>
                <button
                  className="ds-primary-btn"
                  disabled={isRunning || !query.trim()}
                  onClick={runDeepSearch}
                  type="button"
                >
                  {isRunning ? "DeepSearch 正在运行…" : "Run DeepSearch Agent"}
                </button>
                {error ? <p className="ds-warning">{error}</p> : null}
              </div>
            </aside>

            <section className="ds-panel" id="ds-plan">
              <p className="ds-small-label">Agent Timeline</p>
              <div className="ds-timeline">
                {timeline.map((step) => (
                  <div className="ds-timeline-row" key={step.id}>
                    <span
                      aria-hidden
                      className={`ds-timeline-dot${
                        step.status === "pending"
                          ? " is-pending"
                          : step.status === "fail"
                            ? " is-fail"
                            : ""
                      }`}
                    />
                    <div>
                      <b>{step.title}</b>
                      <small>{step.detail}</small>
                    </div>
                    <span
                      className={`ds-score-pill${
                        step.status === "pending"
                          ? " is-pending"
                          : step.status === "fail"
                            ? " is-fail"
                            : ""
                      }`}
                    >
                      {step.pill}
                    </span>
                  </div>
                ))}
              </div>
              {result ? (
                <p className="ds-empty" style={{ marginTop: 14 }}>
                  {result.state.status} · {result.state.currentStep} ·{" "}
                  {result.state.questionsCompleted}/{result.state.questionsTotal} questions
                </p>
              ) : (
                <p className="ds-empty" style={{ marginTop: 14 }}>
                  提交研究问题后，将按 pipeline 展示 Query Understanding → Plan → Evidence → Report。
                </p>
              )}
            </section>
          </div>

          {result ? (
            <>
              <div className="ds-metric-strip" id="ds-evidence">
                <div className="ds-metric-cell">
                  <strong>{result.state.rawItemCount}</strong>
                  <span>Raw Items</span>
                </div>
                <div className="ds-metric-cell">
                  <strong>{result.state.evidenceCount}</strong>
                  <span>Evidence</span>
                </div>
                <div className="ds-metric-cell">
                  <strong>{result.state.findingCount}</strong>
                  <span>Findings</span>
                </div>
                <div className="ds-metric-cell">
                  <strong>{result.state.opportunityCount}</strong>
                  <span>Opportunities</span>
                </div>
              </div>

              <div className="ds-report-grid" id="ds-report">
                <section className="ds-panel">
                  <p className="ds-small-label">Opportunity Cards</p>
                  {opportunities.length ? (
                    opportunities.map((opportunity, index) => (
                      <article className="ds-list-line" key={opportunity.id}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <b>{opportunity.title}</b>
                          <small>
                            score {opportunity.score} · evidence {opportunity.evidenceCount} ·{" "}
                            {opportunity.whyNow}
                          </small>
                        </div>
                        <span className="ds-score-pill">{priorityLabels[opportunity.priority]}</span>
                      </article>
                    ))
                  ) : (
                    <p className="ds-empty">本轮未生成机会卡片。</p>
                  )}
                </section>

                <section className="ds-panel">
                  <p className="ds-small-label">Final Report</p>
                  <div className="ds-brief-block">{buildReportBrief(result)}</div>
                </section>
              </div>

              <details className="ds-advanced">
                <summary>高级 / 调试</summary>
                <div className="ds-advanced-body">
                  <article className="ds-debug-card">
                    <h3>Run State</h3>
                    <div className="ds-debug-row">
                      <span>status</span>
                      <strong>{result.state.status}</strong>
                      <small>
                        vertical: {verticalLabels[result.state.vertical] ?? result.state.vertical} ·
                        depth: {depthLabels[result.state.depth] ?? result.state.depth}
                      </small>
                    </div>
                    <div className="ds-debug-row">
                      <span>counts</span>
                      <small>
                        bundles {result.state.evidenceBundleCount} · findings{" "}
                        {result.state.findingCount}
                      </small>
                    </div>
                  </article>

                  <article className="ds-debug-card">
                    <h3>Query Understanding</h3>
                    <div className="ds-debug-row">
                      <span>intent</span>
                      <strong>{result.understanding.intent}</strong>
                      <small>{result.understanding.rationale}</small>
                    </div>
                    <div className="ds-debug-row">
                      <span>market</span>
                      <strong>{result.understanding.targetMarket}</strong>
                      <small>
                        {result.understanding.timeRange} ·{" "}
                        {result.understanding.requiredSources.join(" / ")}
                      </small>
                    </div>
                    <div className="ds-debug-row">
                      <span>keywords</span>
                      <small>{result.understanding.keywords.join(", ")}</small>
                    </div>
                  </article>

                  <article className="ds-debug-card">
                    <h3>Plan</h3>
                    <p className="ds-empty">{result.plan.goal}</p>
                    {result.plan.questions.map((question) => (
                      <div className="ds-debug-row" key={question.id}>
                        <span>{question.intent}</span>
                        <strong>{question.question}</strong>
                        <small>
                          {question.agent} · {question.sources.join(" / ")}
                        </small>
                      </div>
                    ))}
                  </article>

                  <article className="ds-debug-card">
                    <h3>Source Progress</h3>
                    {result.progress.map((progress, index) => (
                      <div
                        className="ds-debug-row"
                        key={`${progress.questionId}-${progress.source}-${progress.query}-${index}`}
                      >
                        <span>{progress.ok ? "OK" : "FAIL"}</span>
                        <strong>
                          {progress.agent} · {progress.source} · {progress.itemCount} items ·{" "}
                          {progress.durationMs}ms
                        </strong>
                        <small>{progress.error ?? progress.query}</small>
                      </div>
                    ))}
                  </article>

                  <article className="ds-debug-card">
                    <h3>Agent Findings</h3>
                    {result.findings.map((finding) => (
                      <div className="ds-debug-row" key={finding.id}>
                        <span>
                          {finding.agent} · {(finding.confidence * 100).toFixed(0)}%
                        </span>
                        <strong>{finding.summary}</strong>
                        {finding.gaps.length ? (
                          <small>Gaps: {finding.gaps.join("; ")}</small>
                        ) : null}
                        {finding.evidence.slice(0, 3).map((evidence) => (
                          <a href={evidence.url} key={evidence.id} rel="noreferrer" target="_blank">
                            [{evidence.sourceType}] {evidence.title}
                          </a>
                        ))}
                      </div>
                    ))}
                  </article>

                  <article className="ds-debug-card">
                    <h3>Evidence Bundles</h3>
                    {result.evidenceBundles.map((bundle) => (
                      <div className="ds-debug-row" key={bundle.id}>
                        <span>confidence {bundle.confidence}%</span>
                        <strong>{bundle.opportunityCandidate}</strong>
                        <small>{bundle.compressedSummary}</small>
                        {bundle.sources.flatMap((source) =>
                          source.representativeEvidence.slice(0, 2).map((evidence) => (
                            <a
                              href={evidence.url}
                              key={evidence.id}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {source.source}: {evidence.title}
                            </a>
                          ))
                        )}
                      </div>
                    ))}
                  </article>

                  {result.report.citations.length ? (
                    <article className="ds-debug-card">
                      <h3>Citations</h3>
                      {result.report.citations.map((citation) => (
                        <div className="ds-debug-row" key={citation.id}>
                          <span>{citation.sourceType}</span>
                          <a href={citation.url} rel="noreferrer" target="_blank">
                            {citation.title}
                          </a>
                        </div>
                      ))}
                    </article>
                  ) : null}

                  {opportunities.map((opportunity) => (
                    <article className="ds-debug-card" key={`detail-${opportunity.id}`}>
                      <h3>{opportunity.title}</h3>
                      <div className="ds-debug-row">
                        <span>audience</span>
                        <small>{opportunity.audience}</small>
                      </div>
                      <ul>
                        {opportunity.growthActions.map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ul>
                      {opportunity.sourceUrls.map((url) => (
                        <a href={url} key={url} rel="noreferrer" target="_blank">
                          {url}
                        </a>
                      ))}
                    </article>
                  ))}
                </div>
              </details>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
