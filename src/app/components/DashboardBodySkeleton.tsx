export function DashboardBodySkeleton() {
  return (
    <div className="ds-body">
      <section className="ds-hero-strip">
        <div>
          <p className="ds-small-label ds-skeleton-line ds-skeleton-line--sm" />
          <div className="ds-skeleton-line ds-skeleton-line--title" />
          <div className="ds-skeleton-line ds-skeleton-line--lead" />
        </div>
        <aside className="ds-panel ds-control-panel">
          <p className="ds-small-label ds-skeleton-line ds-skeleton-line--sm" />
          <div className="ds-skeleton-line ds-skeleton-line--md" />
          <div className="ds-skeleton-line ds-skeleton-line--sm" />
        </aside>
      </section>

      <section aria-hidden className="ds-metric-strip">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="ds-metric-cell" key={index}>
            <div className="ds-skeleton-line ds-skeleton-line--metric" />
            <div className="ds-skeleton-line ds-skeleton-line--xs" />
          </div>
        ))}
      </section>

      <section className="ds-panel">
        <div className="ds-skeleton-line ds-skeleton-line--md" />
        <div className="ds-skeleton-line ds-skeleton-line--block" />
      </section>
    </div>
  );
}
