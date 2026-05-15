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
  }>;
};

export function BacktestButton() {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runBacktest() {
    setIsRunning(true);
    setError(null);

    const response = await fetch("/api/backtests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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
      <button className="ghost-button" disabled={isRunning} onClick={runBacktest}>
        {isRunning ? "正在回测连接..." : "回测 API 连接"}
      </button>
      {error ? <p className="warning">{error}</p> : null}
      {report ? (
        <div className="backtest-report">
          <div>
            <strong>
              {report.summary.connectedSources}/{report.summary.sources}
            </strong>
            <span>sources connected</span>
          </div>
          <div>
            <strong>{report.summary.totalItems}</strong>
            <span>items analyzed</span>
          </div>
          <div>
            <strong>{report.summary.topScore}%</strong>
            <span>top score</span>
          </div>
          <p>
            mode: {report.connectorMode} / enrichment: {report.enrichmentMode}
          </p>
          {report.sources.map((source) => (
            <p key={source.source}>
              {source.ok ? "OK" : "FAIL"} {source.source} ({source.mode}) · {source.itemCount} items ·{" "}
              {source.durationMs}ms {source.error ? `· ${source.error}` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
