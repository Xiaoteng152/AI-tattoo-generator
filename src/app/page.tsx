import Link from "next/link";
import { canReachDatabase, getDatabaseUnavailableMessage } from "@/lib/db-health";
import { prisma } from "@/lib/prisma";
import { ensureSeedWorkflowConfig } from "@/modules/workflow/seed-config";
import { BacktestButton } from "./components/BacktestButton";
import { RunWorkflowButton } from "./components/RunWorkflowButton";

export const dynamic = "force-dynamic";

type DeepSearchLinkInput = {
  query: string;
  keywords?: string[];
  vertical?: string;
  depth?: string;
};

function buildDeepSearchHref({
  query,
  keywords = [],
  vertical = "ai_tattoo_generator",
  depth = "standard"
}: DeepSearchLinkInput) {
  const params = new URLSearchParams({
    q: query,
    vertical,
    depth
  });

  if (keywords.length) {
    params.set("keywords", keywords.join(", "));
  }

  return `/deepsearch?${params.toString()}`;
}

async function getDashboardData() {
  const databaseReady = await canReachDatabase();

  if (!databaseReady) {
    return { config: null, latestRun: null, error: getDatabaseUnavailableMessage() };
  }

  try {
    const config = await ensureSeedWorkflowConfig();
    const latestRun = await prisma.workflowRun.findFirst({
      orderBy: {
        startedAt: "desc"
      },
      include: {
        steps: true,
        opportunities: {
          orderBy: {
            score: "desc"
          }
        },
        outputAssets: true
      }
    });

    return { config, latestRun, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database is not ready";
    return { config: null, latestRun: null, error: message };
  }
}

export default async function Home() {
  const { config, latestRun, error } = await getDashboardData();
  const productDirection = config?.productDirection ?? "AI tattoo generator";
  const seedKeywords = config?.keywords?.length ? config.keywords : ["ai tattoo generator", "fine line tattoo"];
  const sourceTags = config?.sources?.length
    ? config.sources.filter((source) => source.enabled).map((source) => source.source)
    : ["reddit", "twitter", "etsy"];
  const defaultDeepSearchHref = buildDeepSearchHref({
    query: `Find growth opportunities for ${productDirection} and explain the evidence behind the next best content assets.`,
    keywords: seedKeywords
  });
  const summary = latestRun?.summary as
    | {
        rawItems?: number;
        normalizedItems?: number;
        opportunities?: number;
        outputAssets?: number;
      }
    | null
    | undefined;
  const topAsset = latestRun?.outputAssets[0];
  const opportunityCards =
    latestRun?.opportunities.length
      ? latestRun.opportunities
      : [
          {
            id: "preview-1",
            title: "Fine-line tattoo aging anxiety",
            type: "seo-brief",
            score: 92,
            confidence: 86,
            evidenceSummary: "Reddit pain signal + SEO brief candidate",
            sourceUrls: ["https://www.reddit.com/r/tattoos/comments/mock_ai_tattoo_regret/"],
            recommendedAct: "Publish a brief around fine-line tattoo aging, placement, and artist handoff."
          },
          {
            id: "preview-2",
            title: "Coverup transformation brief bundle",
            type: "product-experiment",
            score: 84,
            confidence: 82,
            evidenceSummary: "Etsy commercial validation + product experiment",
            sourceUrls: ["https://www.etsy.com/listing/mock-coverup-design-brief"],
            recommendedAct: "Validate a paid coverup design brief bundle."
          },
          {
            id: "preview-3",
            title: "Minimal stencil-ready handoff",
            type: "creator-workflow",
            score: 77,
            confidence: 78,
            evidenceSummary: "Creator workflow + visual trend prompt",
            sourceUrls: [],
            recommendedAct: "Prototype stencil-ready export in the MVP funnel."
          }
        ];

  return (
    <main className="ds-page">
      <div className="ds-frame">
        <header className="ds-top">
          <Link className="ds-logo" href="/">
            <span aria-hidden className="ds-logo-dot" />
            Automnic TT
          </Link>
          <nav aria-label="Primary" className="ds-nav">
            <span className="is-active">Dashboard</span>
            <Link href="/deepsearch">DeepSearch</Link>
            <span>Assets</span>
            <span>Local MVP</span>
          </nav>
        </header>

        <div className="ds-body">
          <section className="ds-hero-strip">
            <div>
              <p className="ds-small-label">AI tattoo generator demo vertical</p>
              <h1 className="ds-display-title">Evidence-ranked growth opportunities.</h1>
              <p className="ds-lead-copy">
                从 Reddit、X/Twitter 与 Etsy 信号里保留证据链，归一化后生成机会排序、SEO brief 与可导出资产。
              </p>
            </div>
            <aside className="ds-panel ds-control-panel">
              <p className="ds-small-label">Workflow Control</p>
              <strong className="ds-control-title">{productDirection}</strong>
              {config ? (
                <p className="ds-empty">
                  {config.sources.length} sources · {config.keywords.length} keywords · threshold{" "}
                  {config.reviewThreshold}
                </p>
              ) : (
                <p className="ds-empty">
                  数据库未连接。当前为静态预览；启动 PostgreSQL 后可运行工作流。
                </p>
              )}
              <div className="ds-tag-flow">
                {sourceTags.map((source) => (
                  <span key={source}>{source}</span>
                ))}
                {seedKeywords.map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
              </div>
              <div className="ds-action-stack">
                {error ? <p className="ds-warning">Database setup needed: {error}</p> : <RunWorkflowButton />}
                <Link className="ds-secondary-link" href={defaultDeepSearchHref}>
                  Continue with DeepSearch
                </Link>
              </div>
            </aside>
          </section>

          <section aria-label="Pipeline summary" className="ds-metric-strip">
            <div className="ds-metric-cell">
              <strong>{summary?.rawItems ?? 5}</strong>
              <span>Raw Items</span>
            </div>
            <div className="ds-metric-cell">
              <strong>{summary?.normalizedItems ?? 5}</strong>
              <span>Normalized</span>
            </div>
            <div className="ds-metric-cell">
              <strong>{summary?.opportunities ?? opportunityCards.length}</strong>
              <span>Opportunities</span>
            </div>
            <div className="ds-metric-cell">
              <strong>{summary?.outputAssets ?? 1}</strong>
              <span>Output Assets</span>
            </div>
          </section>

          <section className="ds-panel ds-backtest-section">
            <div className="ds-section-head">
              <div>
                <p className="ds-small-label">Backtest Console</p>
                <h2 className="ds-section-title">关键词回测</h2>
              </div>
              <p className="ds-empty">Reddit / X / Etsy · 按帖子逐条展示</p>
            </div>
            <BacktestButton />
          </section>

          <section className="ds-work-grid">
            <div className="ds-panel">
              <p className="ds-small-label">Opportunity Feed</p>
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
                      className="ds-text-link"
                      href={buildDeepSearchHref({
                        query: `Validate this growth opportunity for ${productDirection}: ${opportunity.title}. Evidence: ${opportunity.evidenceSummary}. Action: ${opportunity.recommendedAct}`,
                        keywords: seedKeywords
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
                      query: `DeepSearch follow-up for generated asset: ${topAsset.title}. Find stronger evidence and distribution angles for ${productDirection}.`,
                      keywords: seedKeywords
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
        </div>
      </div>
    </main>
  );
}
