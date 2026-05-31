"use client";

import Link from "next/link";
import { useState } from "react";
import { buildDeepSearchHref } from "../deepsearch/url";
import { HotSearchPanel } from "./HotSearchPanel";
import { WorkflowControl } from "./WorkflowControl";

type OpportunityCard = {
  id: string;
  title: string;
  type: string;
  score: number;
  confidence: number;
  evidenceSummary: string;
  sourceUrls: string[];
  recommendedAct: string;
};

type OutputAsset = {
  id: string;
  title: string;
  content: string;
};

type DashboardInteractiveProps = {
  dbError: string | null;
  disabled: boolean;
  defaultDeepSearchHref: string;
  lastKeywords: string[];
  lastProductDirection: string;
  latestRunExists: boolean;
  opportunityCards: OpportunityCard[];
  summary: {
    rawItems?: number;
    normalizedItems?: number;
    opportunities?: number;
    outputAssets?: number;
  } | null;
  topAsset: OutputAsset | null;
};

export function DashboardInteractive({
  dbError,
  disabled,
  defaultDeepSearchHref,
  lastKeywords,
  lastProductDirection,
  latestRunExists,
  opportunityCards,
  summary,
  topAsset
}: DashboardInteractiveProps) {
  // 与 WorkflowControl 共享，仅在 Opportunity Feed 标题下展示「正在生成中」。
  const [isGenerating, setIsGenerating] = useState(false);
  const featuredOpportunity = opportunityCards[0];
  const metricItems = [
    { label: "Raw Items", value: summary?.rawItems ?? 5 },
    { label: "Normalized", value: summary?.normalizedItems ?? 5 },
    { label: "Opportunities", value: summary?.opportunities ?? opportunityCards.length },
    { label: "Output Assets", value: summary?.outputAssets ?? 1 }
  ];
  const pipelineSteps = [
    { label: "Capture", detail: "抓取热帖和来源 URL" },
    { label: "Clean", detail: "归一化并去重" },
    { label: "Rank", detail: "AI 评分机会" },
    { label: "Ship", detail: "生成可用资产" }
  ];

  return (
    <>
      <section className="ds-hero-strip">
        <div className="ds-hero-copy">
          <div>
            <p className="ds-small-label">Growth workflow demo</p>
            <h1 className="ds-display-title">Evidence-ranked growth opportunities.</h1>
            <p className="ds-lead-copy">
              从 X/Twitter 关键词搜索里保留证据链，归一化后生成机会排序、SEO brief 与可导出资产。
            </p>
          </div>

          <div className="ds-hero-dashboard" aria-label="Workflow snapshot">
            <div className="ds-hero-metrics">
              {metricItems.map((item) => (
                <div className="ds-mini-metric" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="ds-process-row" aria-label="Pipeline steps">
              {pipelineSteps.map((step, index) => (
                <div className="ds-process-step" key={step.label}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{step.label}</b>
                  <small>{step.detail}</small>
                </div>
              ))}
            </div>

            {featuredOpportunity ? (
              <article className="ds-spotlight-card">
                <div>
                  <p className="ds-small-label">Top opportunity</p>
                  <h2>{featuredOpportunity.title}</h2>
                  <p>
                    证据 {featuredOpportunity.sourceUrls.length} · {featuredOpportunity.recommendedAct}
                  </p>
                </div>
                <Link
                  className="ds-action-link"
                  href={buildDeepSearchHref({
                    query: `Validate: ${featuredOpportunity.title}`
                  })}
                >
                  DeepSearch 验证
                </Link>
                <span className="ds-score-pill">{featuredOpportunity.score}</span>
              </article>
            ) : null}
          </div>
        </div>
        <aside className="ds-panel ds-control-panel">
          <p className="ds-small-label">X Workflow</p>
          <strong className="ds-control-title">输入关键词，直接跑搜索</strong>
          <p className="ds-control-note">选预设或输入关键词，系统会抓取热帖、保留证据链，并生成机会排序。</p>
          <WorkflowControl dbError={dbError} disabled={disabled} onRunningChange={setIsGenerating} />
          <HotSearchPanel />
          <Link className="ds-secondary-link ds-secondary-link--strong" href={defaultDeepSearchHref}>
            Continue with DeepSearch
          </Link>
          {latestRunExists ? (
            <p className="ds-empty">
              上次运行：{lastProductDirection}
              {lastKeywords.length ? ` · ${lastKeywords.join(", ")}` : ""}
            </p>
          ) : null}
        </aside>
      </section>

      <section className="ds-work-grid">
        <div className="ds-panel">
          <div className="ds-feed-head">
            <p className="ds-small-label">Opportunity Feed</p>
            {isGenerating ? (
              <p aria-live="polite" className="ds-inline-status">
                <span aria-hidden className="ds-spinner" />
                正在生成中…
              </p>
            ) : null}
          </div>
          {opportunityCards.map((opportunity, index) => (
            <article className="ds-list-line ds-list-line--rich" key={opportunity.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <b>{opportunity.title}</b>
                <small>
                  {opportunity.type} · {opportunity.evidenceSummary}
                </small>
                <p className="ds-list-detail">
                  证据 {opportunity.sourceUrls.length} · {opportunity.recommendedAct}
                </p>
                <Link
                  className="ds-action-link"
                  href={buildDeepSearchHref({
                    query: `Validate: ${opportunity.title}`
                  })}
                >
                  DeepSearch 验证这个机会
                </Link>
              </div>
              <span className="ds-score-pill">{opportunity.score}</span>
            </article>
          ))}
        </div>

        <aside className="ds-panel">
          <p className="ds-small-label">Generated Asset</p>
          {topAsset ? (
            <>
              <h2 className="ds-section-title">{topAsset.title}</h2>
              <div className="ds-brief-block">{topAsset.content}</div>
              <Link
                className="ds-secondary-link"
                href={buildDeepSearchHref({
                  query: `Follow-up asset: ${topAsset.title}`
                })}
              >
                深挖这份资产的证据和选题
              </Link>
            </>
          ) : (
            <>
              <h2 className="ds-section-title">SEO brief preview</h2>
              <p className="ds-empty">运行工作流后，这里会展示由最高分 Opportunity 生成的 Markdown brief。</p>
              <div className="ds-brief-block">
                {`# Fine line tattoo generator brief\n\n- explain aging risk\n- add placement checklist\n- generate artist handoff brief\n- export markdown`}
              </div>
              <Link className="ds-secondary-link" href={defaultDeepSearchHref}>
                先用 DeepSearch 找机会
              </Link>
            </>
          )}
        </aside>
      </section>
    </>
  );
}
