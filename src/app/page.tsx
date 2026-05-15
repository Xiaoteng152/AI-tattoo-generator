import { canReachDatabase, getDatabaseUnavailableMessage } from "@/lib/db-health";
import { prisma } from "@/lib/prisma";
import { ensureSeedWorkflowConfig } from "@/modules/workflow/seed-config";
import { BacktestButton } from "./components/BacktestButton";
import { RunWorkflowButton } from "./components/RunWorkflowButton";

export const dynamic = "force-dynamic";

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
            title: "fine line tattoo generator: users worry tiny designs will blur over time",
            type: "seo-brief",
            score: 92,
            confidence: 86,
            evidenceSummary: "REDDIT signal: users want stencil-ready fine line tattoos with aging guidance.",
            sourceUrls: ["https://www.reddit.com/r/tattoos/comments/mock_ai_tattoo_regret/"],
            recommendedAct: "Publish a brief around fine-line tattoo aging, placement, and artist handoff."
          },
          {
            id: "preview-2",
            title: "tattoo coverup design: buyers need artist-ready transformation briefs",
            type: "product-experiment",
            score: 84,
            confidence: 82,
            evidenceSummary: "ETSY signal: paid coverup concept boards validate commercial demand.",
            sourceUrls: ["https://www.etsy.com/listing/mock-coverup-design-brief"],
            recommendedAct: "Validate a paid coverup design brief bundle."
          }
        ];

  return (
    <main>
      <nav className="topbar">
        <div className="brand">
          <span className="brand-mark">TT</span>
          <span>Automnic TT</span>
        </div>
        <div className="nav-links">
          <a>机会监控</a>
          <a>DeepSearch</a>
          <a>SEO 资产</a>
          <a>工作流</a>
        </div>
        <span className="login">本地 MVP</span>
      </nav>

      <section className="shell">
        <div className="hero">
          <div className="hero-copy">
            <div className="hot-badge">AI tattoo generator demo</div>
            <h1 className="title">增长机会热榜监控</h1>
            <p className="lead">
              通过 Reddit、X/Twitter 与 Etsy 信号，发现正在升温的用户痛点、商业需求和内容机会。点击运行后，系统会保存证据链并生成可审核的 Markdown SEO brief。
            </p>
            <div className="tabs">
              <span className="tab active">AI tattoo</span>
              <span className="tab">Reddit 痛点</span>
              <span className="tab">X/Twitter 热帖</span>
              <span className="tab">Etsy 商业验证</span>
              <span className="tab">SEO brief</span>
            </div>
          </div>

          <aside className="run-card">
            <div className="tattoo-flash" aria-hidden="true">
              <span>✦</span>
              <span>AI</span>
              <span>INK</span>
            </div>
            <p className="eyebrow">Workflow Control</p>
            <h2>{config?.productDirection ?? "AI tattoo generator"}</h2>
            <p className="muted">
              {config
                ? `${config.sources.length} sources / ${config.keywords.length} keywords / threshold ${config.reviewThreshold}`
                : "数据库未连接。当前展示静态预览，启动 PostgreSQL 后可运行工作流。"}
            </p>
            {config ? (
              <div className="pill-row">
                {config.keywords.map((keyword) => (
                  <span className="pill" key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
            ) : null}
            {error ? <p className="warning">Database setup needed: {error}</p> : <RunWorkflowButton />}
          </aside>
        </div>

        <section className="metrics">
          <div className="metric">
            <span className="metric-kicker">captured</span>
            <strong>{summary?.rawItems ?? 5}</strong>
            <span>Raw Items</span>
          </div>
          <div className="metric">
            <span className="metric-kicker">cleaned</span>
            <strong>{summary?.normalizedItems ?? 5}</strong>
            <span>Normalized</span>
          </div>
          <div className="metric">
            <span className="metric-kicker">ranked</span>
            <strong>{summary?.opportunities ?? opportunityCards.length}</strong>
            <span>Opportunities</span>
          </div>
          <div className="metric">
            <span className="metric-kicker">shipped</span>
            <strong>{summary?.outputAssets ?? 1}</strong>
            <span>Output Assets</span>
          </div>
        </section>

        <section className="backtest-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Backtest Console</p>
              <h2>关键词回测结果</h2>
            </div>
            <span className="refresh">默认回测比特币，结果按帖子逐条展示</span>
          </div>
          <BacktestButton />
        </section>

        <section className="dashboard-grid">
          <div className="feed">
            <div className="section-head">
              <div>
                <p className="eyebrow">Opportunity Feed</p>
                <h2>正在升温的增长机会</h2>
              </div>
              <span className="refresh">数据更新于本地运行后</span>
            </div>

            {opportunityCards.map((opportunity, index) => (
              <article className="hot-card" key={opportunity.id}>
                <div className="rank">
                  <span>#{index + 1}</span>
                </div>
                <div className="hot-main">
                  <div className="author-row">
                    <strong>{opportunity.type}</strong>
                    <span>· evidence-backed opportunity</span>
                  </div>
                  <h3>{opportunity.title}</h3>
                  <p>{opportunity.evidenceSummary}</p>
                  <div className="signal-row">
                    <span>来源证据 {opportunity.sourceUrls.length}</span>
                    <span>推荐动作：{opportunity.recommendedAct}</span>
                  </div>
                </div>
                <aside className="score-box">
                  <div>
                    <span>机会分</span>
                    <strong>{opportunity.score}%</strong>
                  </div>
                  <div>
                    <span>置信度</span>
                    <strong>{opportunity.confidence}%</strong>
                  </div>
                </aside>
              </article>
            ))}
          </div>

          <aside className="asset-panel">
            <p className="eyebrow">Generated Asset</p>
            {topAsset ? (
              <>
                <h2>{topAsset.title}</h2>
                <pre className="brief">{topAsset.content}</pre>
              </>
            ) : (
              <>
                <h2>SEO brief 预览</h2>
                <p className="muted">运行工作流后，这里会展示由最高分 Opportunity 生成的 Markdown brief。</p>
                <div className="brief empty-brief">
                  # Fine line tattoo generator brief{"\n\n"}- 解释纹身老化风险{"\n"}- 给出 stencil-ready 检查表{"\n"}-
                  引导用户生成 artist handoff brief
                </div>
              </>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}
