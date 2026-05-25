import Link from "next/link";
import { DashboardBodySkeleton } from "./DashboardBodySkeleton";
import { SiteNav } from "./SiteNav";

export function DashboardPageSkeleton() {
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

        <DashboardBodySkeleton />
      </div>
    </main>
  );
}
