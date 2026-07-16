import Link from "next/link";

export const GITHUB_REPO_URL = "https://github.com/Xiaoteng152/AI-tattoo-generator";

type SiteNavProps = {
  active: "dashboard" | "deepsearch" | "trading";
};

export function SiteNav({ active }: SiteNavProps) {
  return (
    <nav aria-label="Primary" className="ds-nav">
      {active === "dashboard" ? (
        <span className="is-active">Dashboard</span>
      ) : (
        <Link href="/">Dashboard</Link>
      )}
      {active === "deepsearch" ? (
        <span className="is-active">DeepSearch</span>
      ) : (
        <Link href="/deepsearch">DeepSearch</Link>
      )}
      {active === "trading" ? (
        <span className="is-active">Trading Radar</span>
      ) : (
        <Link href="/trading-radar">Trading Radar</Link>
      )}
      <a href={GITHUB_REPO_URL} rel="noreferrer" target="_blank">
        GitHub
      </a>
    </nav>
  );
}
