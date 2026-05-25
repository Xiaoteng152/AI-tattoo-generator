"use client";

import { useEffect, useState } from "react";

type HotTweet = {
  author: string;
  body: string;
  sourceUrl: string;
  viralProbability: number;
  views: number;
};

function formatViews(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }

  return value.toLocaleString();
}

export function HotSearchPanel() {
  const [items, setItems] = useState<HotTweet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHotTweets() {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/hot-tweets?limit=5");
      const payload = (await response.json().catch(() => null)) as
        | { items?: HotTweet[]; error?: string }
        | null;

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setError(payload?.error ?? "最热搜索加载失败");
        setItems([]);
        setIsLoading(false);
        return;
      }

      setItems(payload?.items ?? []);
      setIsLoading(false);
    }

    void loadHotTweets();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="ds-hot-search">
      <div className="ds-hot-search-head">
        <p className="ds-small-label">今日最热搜索</p>
        <span className="ds-hot-search-meta">SoPilot 热帖 · 今日</span>
      </div>

      {isLoading ? (
        <p className="ds-inline-status">
          <span aria-hidden className="ds-spinner" />
          加载热帖中…
        </p>
      ) : null}

      {!isLoading && error ? <p className="ds-empty">{error}</p> : null}

      {!isLoading && !error && items.length === 0 ? (
        <p className="ds-empty">今天还没有热帖数据。</p>
      ) : null}

      {!isLoading && !error
        ? items.map((item, index) => (
            <article className="ds-hot-search-item" key={`${item.sourceUrl}-${index}`}>
              <div className="ds-hot-search-item-head">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.author}</strong>
                <span className="ds-hot-search-heat">{item.viralProbability}% · {formatViews(item.views)} 浏览</span>
              </div>
              <p>{item.body}</p>
              <a className="ds-text-link" href={item.sourceUrl} rel="noreferrer" target="_blank">
                查看原帖
              </a>
            </article>
          ))
        : null}
    </div>
  );
}
