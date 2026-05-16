"use client";

import Link from "next/link";
import { useState } from "react";

type DeepSearchResult = {
  state: {
    status: string;
    currentStep: string;
    questionsCompleted: number;
    questionsTotal: number;
    rawItemCount: number;
    evidenceBundleCount: number;
    opportunityCount: number;
    error?: string;
  };
  plan: {
    goal: string;
    seedKeywords: string[];
    questions: Array<{
      id: string;
      question: string;
      intent: string;
      sources: string[];
      queries: string[];
    }>;
  };
  progress: Array<{
    questionId: string;
    source: string;
    query: string;
    ok: boolean;
    itemCount: number;
    durationMs: number;
    error?: string;
  }>;
  evidenceBundles: Array<{
    id: string;
    questionId: string;
    opportunityCandidate: string;
    compressedSummary: string;
    confidence: number;
    sources: Array<{
      source: string;
      representativeEvidence: Array<{
        title: string;
        url: string;
        metricSummary: string;
        whyItMatters: string;
      }>;
    }>;
  }>;
  report: {
    title: string;
    summary: string;
    risks: string[];
    nextSearchSuggestions: string[];
    topOpportunities: Array<{
      title: string;
      score: number;
      confidence: number;
      recommendedActions: string[];
      sourceUrls: string[];
    }>;
  };
};

const defaultKeywords = "ai tattoo, tattoo generator, minimal tattoo, fine line tattoo";

export default function DeepSearchPage() {
  const [goal, setGoal] = useState("Find source-backed growth opportunities for AI tattoo generator");
  const [keywords, setKeywords] = useState(defaultKeywords);
  const [result, setResult] = useState<DeepSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runDeepSearch() {
    const seedKeywords = keywords
      .split(/[,，\n]/)
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    setIsRunning(true);
    setError(null);
    setResult(null);

    const response = await fetch("/api/deepsearch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        goal,
        seedKeywords,
        limitPerSource: 3,
        lookbackDays: 30
      })
    });
    const payload = (await response.json().catch(() => null)) as { result?: DeepSearchResult; error?: string } | null;

    setIsRunning(false);

    if (!response.ok || !payload?.result) {
      setError(typeof payload?.error === "string" ? payload.error : "DeepSearch run failed");
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
          <span className="hot-badge">DeepSearch Agent</span>
          <h1 className="title">可追溯增长研究 Agent</h1>
          <p className="lead">
            按 `agent-design.md` 的 loop：先规划问题，再路由数据源，压缩证据包，最后生成可审核的机会报告。
          </p>
        </div>
        <div className="deepsearch-controls">
          <label className="backtest-field">
            <span>研究目标</span>
            <input disabled={isRunning} onChange={(event) => setGoal(event.target.value)} value={goal} />
          </label>
          <label className="backtest-field">
            <span>种子关键词</span>
            <input disabled={isRunning} onChange={(event) => setKeywords(event.target.value)} value={keywords} />
          </label>
          <button className="ghost-button" disabled={isRunning || !goal.trim()} onClick={runDeepSearch} type="button">
            {isRunning ? "DeepSearch 正在运行..." : "运行 DeepSearch Agent"}
          </button>
          {error ? <p className="warning">{error}</p> : null}
        </div>
      </section>

      {result ? (
        <section className="deepsearch-grid">
          <article className="deepsearch-card">
            <h2>Run State</h2>
            <div className="deepsearch-stats">
              <strong>{result.state.status}</strong>
              <span>{result.state.currentStep}</span>
              <span>
                {result.state.questionsCompleted}/{result.state.questionsTotal} questions
              </span>
              <span>{result.state.rawItemCount} raw items</span>
              <span>{result.state.evidenceBundleCount} bundles</span>
            </div>
          </article>

          <article className="deepsearch-card">
            <h2>Plan</h2>
            <div className="question-list">
              {result.plan.questions.map((question) => (
                <div className="question-row" key={question.id}>
                  <span>{question.intent}</span>
                  <strong>{question.question}</strong>
                  <small>{question.sources.join(" / ")}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="deepsearch-card">
            <h2>Source Progress</h2>
            <div className="question-list">
              {result.progress.map((progress) => (
                <div className="question-row" key={`${progress.questionId}-${progress.source}-${progress.query}`}>
                  <span>{progress.ok ? "OK" : "FAIL"}</span>
                  <strong>
                    {progress.source} · {progress.itemCount} items · {progress.durationMs}ms
                  </strong>
                  <small>{progress.error ?? progress.query}</small>
                </div>
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
                      <a href={evidence.url} key={evidence.url} rel="noreferrer" target="_blank">
                        {source.source}: {evidence.title}
                      </a>
                    ))
                  )}
                </section>
              ))}
            </div>
          </article>

          <article className="deepsearch-card wide">
            <h2>Report</h2>
            <p>{result.report.summary}</p>
            <div className="opportunity-list">
              {result.report.topOpportunities.map((opportunity) => (
                <section className="opportunity-card" key={opportunity.title}>
                  <div>
                    <span>
                      score {opportunity.score}% / confidence {opportunity.confidence}%
                    </span>
                    <h3>{opportunity.title}</h3>
                  </div>
                  <p>{opportunity.recommendedActions[0]}</p>
                  <a href={opportunity.sourceUrls[0]} rel="noreferrer" target="_blank">
                    查看首条证据
                  </a>
                </section>
              ))}
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
