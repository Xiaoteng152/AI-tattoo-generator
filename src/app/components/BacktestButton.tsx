"use client";

import { useState } from "react";

type BacktestReport = {
  connectorMode: string;
  enrichmentMode: string;
  summary: {
    connectedSources: number;
    sources: number;
    totalItems: number;
    opportunities: number;
    topScore: number;
  };
  sources: Array<{
    source: string;
    mode: string;
    ok: boolean;
    itemCount: number;
    durationMs: number;
    error?: string;
    sampleTitles: string[];
    analyzed: Array<{
      rawItem: {
        source: string;
        sourceUrl: string;
        title: string;
        body: string;
        author?: string;
        publishedAt?: string;
        metrics: {
          upvotes?: number;
          comments?: number;
          favorites?: number;
          salesSignal?: number;
          saves?: number;
        };
      };
      enrichment: {
        painPoints: string[];
        evidenceSummary: string;
        keywords: string[];
        contentAngles: string[];
      };
      opportunity: {
        score: number;
        confidence: number;
        recommendedAct: string;
      };
    }>;
  }>;
};

function compactBody(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 180);
}

function metricLine(metrics: BacktestReport["sources"][number]["analyzed"][number]["rawItem"]["metrics"]) {
  const parts = [
    metrics.upvotes !== undefined ? `${metrics.upvotes} upvotes` : null,
    metrics.comments !== undefined ? `${metrics.comments} comments` : null,
    metrics.favorites !== undefined ? `${metrics.favorites} favorites` : null,
    metrics.saves !== undefined ? `${metrics.saves} views` : null
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "no metrics";
}

function formatRelativeDate(value?: string) {
  if (!value) {
    return "未知时间";
  }

  const elapsedMs = Date.now() - new Date(value).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (elapsedMs < minute) {
    return "刚刚";
  }

  if (elapsedMs < hour) {
    return `${Math.floor(elapsedMs / minute)}分钟前`;
  }

  if (elapsedMs < day) {
    return `${Math.floor(elapsedMs / hour)}小时前`;
  }

  if (elapsedMs < month) {
    return `${Math.floor(elapsedMs / day)}天前`;
  }

  if (elapsedMs < year) {
    return `${Math.floor(elapsedMs / month)}个月前`;
  }

  return `${Math.floor(elapsedMs / year)}年前`;
}

export function BacktestButton() {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keywordText, setKeywordText] = useState("比特币");

  async function runBacktest() {
    const keywords = keywordText
      .split(/[,，\n]/)
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    setIsRunning(true);
    setError(null);
    setReport(null);

    const response = await fetch("/api/backtests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productDirection: `${keywords[0] ?? "比特币"} 增长机会`,
        keywords: keywords.length ? keywords : ["比特币"],
        limitPerSource: 4,
        lookbackDays: 30
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(typeof payload?.error === "string" ? payload.error : "Backtest failed");
      setIsRunning(false);
      return;
    }

    const payload = (await response.json()) as { report: BacktestReport };
    setReport(payload.report);
    setIsRunning(false);
  }

  return (
    <div className="backtest-console">
      <label className="backtest-field">
        <span>回测关键词</span>
        <input
          disabled={isRunning}
          onChange={(event) => setKeywordText(event.target.value)}
          placeholder="例如：比特币、AI tattoo、fine line tattoo"
          value={keywordText}
        />
      </label>
      <button className="ghost-button" disabled={isRunning || !keywordText.trim()} onClick={runBacktest}>
        {isRunning ? "正在回测连接..." : `回测 ${keywordText || "关键词"}`}
      </button>
      {error ? <p className="warning">{error}</p> : null}
      {report ? (
        <div className="backtest-report">
          <div className="backtest-summary">
            <div className="backtest-stat">
              <strong>
                {report.summary.connectedSources}/{report.summary.sources}
              </strong>
              <span>sources connected</span>
            </div>
            <div className="backtest-stat">
              <strong>{report.summary.totalItems}</strong>
              <span>items analyzed</span>
            </div>
            <div className="backtest-stat">
              <strong>{report.summary.topScore}%</strong>
              <span>top score</span>
            </div>
          </div>
          <p>
            mode: {report.connectorMode} / enrichment: {report.enrichmentMode}
          </p>
          {report.sources.map((source) => (
            <section className="backtest-source" key={source.source}>
              <p>
                {source.ok ? "OK" : "FAIL"} {source.source} ({source.mode}) · {source.itemCount} items ·{" "}
                {source.durationMs}ms {source.error ? `· ${source.error}` : ""}
              </p>
              <div className="backtest-posts">
                {source.analyzed.length ? (
                  source.analyzed.map((item) => (
                    <article className="backtest-post" key={item.rawItem.sourceUrl}>
                      <div className="post-topline">
                        <span>{item.rawItem.source}</span>
                        <span>
                          score {item.opportunity.score}% / confidence {item.opportunity.confidence}%
                        </span>
                      </div>
                      <h4>
                        <a href={item.rawItem.sourceUrl} rel="noreferrer" target="_blank">
                          {item.rawItem.title}
                        </a>
                        <time dateTime={item.rawItem.publishedAt}>{formatRelativeDate(item.rawItem.publishedAt)}</time>
                      </h4>
                      <p>{compactBody(item.rawItem.body) || item.enrichment.evidenceSummary}</p>
                      <div className="post-meta">
                        <span>{item.rawItem.author ?? "unknown author"}</span>
                        <span>{metricLine(item.rawItem.metrics)}</span>
                      </div>
                      <p className="post-action">{item.opportunity.recommendedAct}</p>
                      <div className="ai-summary">
                        <span>AI 总结</span>
                        <strong>{item.enrichment.evidenceSummary}</strong>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="empty-source">这次回测没有从 {source.source} 抓到帖子。</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
