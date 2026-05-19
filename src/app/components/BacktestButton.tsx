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
        payload?: Record<string, unknown>;
        metrics: {
          upvotes?: number;
          comments?: number;
          favorites?: number;
          salesSignal?: number;
          saves?: number;
          retweets?: number;
          replies?: number;
          views?: number;
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

type SopilotPayload = {
  provider?: string;
  authorName?: string;
  handle?: string;
  sopilotUrl?: string;
  viralProbability?: number;
  predictedViews?: number;
  predictedCommentViews?: number;
};

function compactBody(body: string) {
  const compacted = body.replace(/\s+/g, " ").trim();

  if (compacted.length <= 260) {
    return compacted;
  }

  return `${compacted.slice(0, 260).trimEnd()}.....`;
}

function metricLine(metrics: BacktestReport["sources"][number]["analyzed"][number]["rawItem"]["metrics"]) {
  const parts = [
    metrics.upvotes !== undefined ? `${metrics.upvotes} upvotes` : null,
    metrics.comments !== undefined ? `${metrics.comments} comments` : null,
    metrics.favorites !== undefined ? `${metrics.favorites} favorites` : null,
    metrics.retweets !== undefined ? `${metrics.retweets} reposts` : null,
    metrics.replies !== undefined ? `${metrics.replies} replies` : null,
    metrics.views !== undefined ? `${metrics.views} views` : null,
    metrics.saves !== undefined ? `${metrics.saves} views` : null
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "no metrics";
}

function formatCompactNumber(value?: number) {
  if (value === undefined) {
    return "--";
  }

  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 1 : 1)}万`;
  }

  return value.toLocaleString("zh-CN");
}

function getSopilotPayload(payload?: Record<string, unknown>): SopilotPayload | null {
  if (payload?.provider !== "sopilot") {
    return null;
  }

  return payload as SopilotPayload;
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

const sourceTabs = [
  { id: "reddit", label: "Reddit 痛点" },
  { id: "twitter", label: "X/Twitter 热帖" },
  { id: "etsy", label: "Etsy 商业验证" }
] as const;

export function BacktestButton() {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keywordText, setKeywordText] = useState("比特币");
  const [selectedSource, setSelectedSource] = useState<(typeof sourceTabs)[number]["id"]>("reddit");

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
        lookbackDays: 30,
        sources: [selectedSource]
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
    <div className="ds-backtest-console">
      <div className="ds-source-tabs" aria-label="选择回测数据源">
        {sourceTabs.map((source) => (
          <button
            className={`ds-source-tab${selectedSource === source.id ? " is-active" : ""}`}
            disabled={isRunning}
            key={source.id}
            onClick={() => setSelectedSource(source.id)}
            type="button"
          >
            {source.label}
          </button>
        ))}
      </div>
      <label className="ds-field">
        <span>回测关键词</span>
        <input
          disabled={isRunning}
          onChange={(event) => setKeywordText(event.target.value)}
          placeholder="例如：比特币、AI tattoo、fine line tattoo"
          value={keywordText}
        />
      </label>
      <button
        className="ds-secondary-btn"
        disabled={isRunning || !keywordText.trim()}
        onClick={runBacktest}
        type="button"
      >
        {isRunning ? "正在回测连接..." : `回测 ${keywordText || "关键词"}`}
      </button>
      {error ? <p className="ds-warning">{error}</p> : null}
      {report ? (
        <div className="ds-backtest-report">
          <div className="ds-backtest-summary">
            <div className="ds-backtest-stat">
              <strong>
                {report.summary.connectedSources}/{report.summary.sources}
              </strong>
              <span>sources connected</span>
            </div>
            <div className="ds-backtest-stat">
              <strong>{report.summary.totalItems}</strong>
              <span>items analyzed</span>
            </div>
            <div className="ds-backtest-stat">
              <strong>{report.summary.topScore}%</strong>
              <span>top score</span>
            </div>
          </div>
          <p className="ds-empty">
            mode: {report.connectorMode} / enrichment: {report.enrichmentMode}
          </p>
          {report.sources.map((source) => (
            <section className="ds-backtest-source" key={source.source}>
              <p className="ds-empty">
                {source.ok ? "OK" : "FAIL"} {source.source} ({source.mode}) · {source.itemCount} items ·{" "}
                {source.durationMs}ms {source.error ? `· ${source.error}` : ""}
              </p>
              <div className="ds-backtest-posts">
                {source.analyzed.length ? (
                  source.analyzed.map((item) => {
                    const sopilotPayload = getSopilotPayload(item.rawItem.payload);

                    return (
                      <article
                        className={`ds-backtest-post${sopilotPayload ? " is-twitter-hot" : ""}`}
                        key={item.rawItem.sourceUrl}
                      >
                        <div className="ds-post-topline">
                          <span>{sopilotPayload ? "X HOT TWEET" : item.rawItem.source}</span>
                          <span>
                            score {item.opportunity.score}% / confidence {item.opportunity.confidence}%
                          </span>
                        </div>
                        <div className="ds-post-main">
                          <div className="ds-post-content">
                            <h4>
                              <a href={item.rawItem.sourceUrl} rel="noreferrer" target="_blank">
                                {sopilotPayload ? (item.rawItem.author ?? "unknown author") : item.rawItem.title}
                              </a>
                              <time dateTime={item.rawItem.publishedAt}>
                                {formatRelativeDate(item.rawItem.publishedAt)}发布
                              </time>
                            </h4>
                            <p>{compactBody(item.rawItem.body) || item.enrichment.evidenceSummary}</p>
                            <div className="ds-post-meta">
                              <span>{metricLine(item.rawItem.metrics)}</span>
                              <span>数据更新于 {formatRelativeDate(item.rawItem.publishedAt)}</span>
                            </div>
                            <p className="ds-post-action">{item.opportunity.recommendedAct}</p>
                          </div>
                          {sopilotPayload ? (
                            <aside className="ds-tweet-signal-panel">
                              <div>
                                <span>起爆概率</span>
                                <strong>{sopilotPayload.viralProbability ?? item.opportunity.score}%</strong>
                              </div>
                              <div>
                                <span>预测浏览量</span>
                                <strong>{formatCompactNumber(sopilotPayload.predictedViews)}</strong>
                              </div>
                              <button type="button">生成评论</button>
                              <a href={item.rawItem.sourceUrl} rel="noreferrer" target="_blank">
                                查看原贴
                              </a>
                              <small>
                                评论预计可获得 {formatCompactNumber(sopilotPayload.predictedCommentViews)} 次曝光
                              </small>
                            </aside>
                          ) : null}
                        </div>
                        <div className="ds-ai-summary">
                          <span>AI 总结</span>
                          <strong>{item.enrichment.evidenceSummary}</strong>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="ds-empty">这次回测没有从 {source.source} 抓到帖子。</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
