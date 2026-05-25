import Link from "next/link";
import { Suspense } from "react";
import {
  getDatabaseUnavailableMessage,
  withTimeout
} from "@/lib/db-health";
import { prisma } from "@/lib/prisma";
import { buildDeepSearchHref } from "../deepsearch/url";
import { BacktestButton } from "../components/BacktestButton";
import { DashboardBodySkeleton } from "../components/DashboardBodySkeleton";
import { DashboardInteractive } from "../components/DashboardInteractive";
import { SiteNav } from "../components/SiteNav";

const QUERY_TIMEOUT_MS = Number(process.env.DATABASE_QUERY_TIMEOUT_MS ?? 8000);

async function getDashboardData() {
  try {
    const latestRun = await withTimeout(
      prisma.workflowRun.findFirst({
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
      }),
      QUERY_TIMEOUT_MS
    );

    return { latestRun, error: null };
  } catch {
    return { latestRun: null, error: getDatabaseUnavailableMessage() };
  }
}

const previewOpportunityCards = [
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

async function DashboardBody() {
  const { latestRun, error } = await getDashboardData();
  const defaultDeepSearchHref = buildDeepSearchHref();
  const summary = latestRun?.summary as
    | {
        keywords?: string[];
        productDirection?: string;
        rawItems?: number;
        normalizedItems?: number;
        opportunities?: number;
        outputAssets?: number;
      }
    | null
    | undefined;
  const lastKeywords = summary?.keywords?.length ? summary.keywords : [];
  const lastProductDirection = summary?.productDirection ?? "Growth research";
  const topAsset = latestRun?.outputAssets[0];
  const opportunityCards = latestRun?.opportunities.length ? latestRun.opportunities : previewOpportunityCards;

  return (
    <div className="ds-body">
      <DashboardInteractive
        dbError={error}
        defaultDeepSearchHref={defaultDeepSearchHref}
        disabled={Boolean(error)}
        lastKeywords={lastKeywords}
        lastProductDirection={lastProductDirection}
        latestRunExists={Boolean(latestRun)}
        opportunityCards={opportunityCards}
        summary={summary ?? null}
        topAsset={topAsset ?? null}
      />

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
    </div>
  );
}

export default function Home() {
  return (
    <main className="ds-page">
      <div className="ds-frame">
        <header className="ds-top">
          <Link className="ds-logo" href="/">
            <span aria-hidden className="ds-logo-dot" />
            Automnic TT
          </Link>
          <div className="ds-top-end">
            <SiteNav active="dashboard" />
          </div>
        </header>

        <Suspense fallback={<DashboardBodySkeleton />}>
          <DashboardBody />
        </Suspense>
      </div>
    </main>
  );
}
