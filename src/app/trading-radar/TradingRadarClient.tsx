"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./trading-radar.module.css";

type Creator = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  enabled: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  unreadCount: number;
};

type CreatorPost = {
  id: string;
  creatorId: string;
  externalId: string;
  sourceUrl: string;
  body: string;
  publishedAt: string;
  postType: string;
  isInitialImport: boolean;
  readAt: string | null;
  creator: Creator;
};

type TradingSignal = {
  asset: string;
  direction: "LONG" | "SHORT" | "WATCH" | "NONE";
  entryPrice: string;
  entryTiming: string;
  invalidation: string;
  strategyMatch: "MATCH" | "CONFLICT" | "UNKNOWN";
  strategyReason: string;
  sourceUrls: string[];
};

type DigestResult = {
  id: string;
  digest: { summary: string[]; signals: TradingSignal[] };
  strategySnapshot?: string;
  strategyVersion?: number;
  createdAt: string;
};

type RadarSnapshot = {
  creators: Creator[];
  selectedIds: string[];
  posts: CreatorPost[];
  strategy: { content: string; version: number };
  latestDigest: DigestResult | null;
  integrations: { aiConfigured: boolean; telegramConfigured: boolean; xConfigured: boolean };
};

function relativeTime(value: string | null) {
  if (!value) return "尚未同步";
  const distance = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(distance / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} 小时前`;
  return `${Math.round(minutes / 1440)} 天前`;
}

function postTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error ?? "请求失败");
  return payload as T;
}

function strategyLabel(value: TradingSignal["strategyMatch"]) {
  if (value === "MATCH") return "符合策略";
  if (value === "CONFLICT") return "与策略冲突";
  return "无法判断";
}

export function TradingRadarClient() {
  const [snapshot, setSnapshot] = useState<RadarSnapshot | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [view, setView] = useState<"new" | "all">("new");
  const [creatorInput, setCreatorInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [strategyDraft, setStrategyDraft] = useState("");
  const postRefs = useRef(new Map<string, HTMLElement>());

  async function loadSnapshot(ids?: string[]) {
    const query = ids?.length ? `?${ids.map((id) => `creatorId=${encodeURIComponent(id)}`).join("&")}` : "";
    const data = await jsonRequest<RadarSnapshot>(`/api/trading-radar${query}`);
    setSnapshot(data);
    setSelectedIds(ids?.length ? ids : data.selectedIds);
    setStrategyDraft(data.strategy.content);
    return data;
  }

  useEffect(() => {
    let cancelled = false;
    jsonRequest<RadarSnapshot>("/api/trading-radar")
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
        setSelectedIds(data.selectedIds);
        setStrategyDraft(data.strategy.content);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "加载失败");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePosts = useMemo(() => {
    const posts = snapshot?.posts ?? [];
    return posts.filter((post) => view === "all" || (!post.isInitialImport && !post.readAt));
  }, [snapshot?.posts, view]);
  const newPosts = useMemo(
    () => (snapshot?.posts ?? []).filter((post) => !post.isInitialImport && !post.readAt),
    [snapshot?.posts]
  );

  async function selectCreators(nextIds: string[]) {
    if (!nextIds.length) return;
    setError(null);
    try {
      const data = await loadSnapshot(nextIds);
      if (data.integrations.aiConfigured && data.posts.some((post) => post.readAt === null)) {
        const digest = await jsonRequest<{ result: DigestResult | null }>("/api/trading-radar/digest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorIds: nextIds })
        });
        if (digest.result) setSnapshot((current) => (current ? { ...current, latestDigest: digest.result } : current));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "筛选失败");
    }
  }

  async function toggleCreatorEnabled(creator: Creator) {
    setIsBusy(true);
    setError(null);
    try {
      await jsonRequest(`/api/trading-radar/creators/${creator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !creator.enabled })
      });
      await loadSnapshot(selectedIds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新博主状态失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function addCreator(event: FormEvent) {
    event.preventDefault();
    if (!creatorInput.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      await jsonRequest("/api/trading-radar/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: creatorInput })
      });
      setCreatorInput("");
      await loadSnapshot();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "添加失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function syncNow() {
    setIsBusy(true);
    setError(null);
    try {
      await jsonRequest("/api/trading-radar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorIds: selectedIds })
      });
      await loadSnapshot(selectedIds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "同步失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function markRead(postId: string) {
    const post = snapshot?.posts.find((item) => item.id === postId);
    if (!post || post.readAt) return;
    setHighlightedId(postId);
    setSnapshot((current) =>
      current
        ? {
            ...current,
            posts: current.posts.map((item) => (item.id === postId ? { ...item, readAt: new Date().toISOString() } : item)),
            creators: current.creators.map((creator) =>
              creator.id === post.creatorId
                ? { ...creator, unreadCount: Math.max(0, creator.unreadCount - (post.isInitialImport ? 0 : 1)) }
                : creator
            )
          }
        : current
    );
    await jsonRequest(`/api/trading-radar/posts/${postId}`, { method: "PATCH" }).catch(() => undefined);
  }

  async function markAllRead() {
    await jsonRequest("/api/trading-radar/posts/read-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorIds: selectedIds })
    });
    await loadSnapshot(selectedIds);
  }

  function jumpToPost(postId: string) {
    setHighlightedId(postId);
    setView("all");
    requestAnimationFrame(() => postRefs.current.get(postId)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function saveStrategy() {
    setIsBusy(true);
    setError(null);
    try {
      await jsonRequest("/api/trading-radar/strategy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: strategyDraft })
      });
      setStrategyOpen(false);
      await loadSnapshot(selectedIds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function analyzeAgain() {
    setIsBusy(true);
    setError(null);
    try {
      const payload = await jsonRequest<{ result: DigestResult | null }>("/api/trading-radar/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorIds: selectedIds, force: true })
      });
      setSnapshot((current) => (current ? { ...current, latestDigest: payload.result } : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "分析失败");
    } finally {
      setIsBusy(false);
    }
  }

  if (!snapshot) {
    return <p className={styles.loading}>正在加载交易雷达…</p>;
  }

  return (
    <>
      {error ? <div className={styles.errorBanner}>{error}</div> : null}
      <section className={styles.workspace}>
        <aside className={styles.leftPanel}>
          <div className={styles.panelHead}>
            <div>
              <span className={styles.kicker}>Watchlist</span>
              <h2>关注博主</h2>
            </div>
            <span className={styles.count}>{snapshot.creators.length}</span>
          </div>

          <form className={styles.addForm} onSubmit={addCreator}>
            <input
              aria-label="X 博主 handle 或主页链接"
              onChange={(event) => setCreatorInput(event.target.value)}
              placeholder="@handle 或 X 主页链接"
              value={creatorInput}
            />
            <button disabled={isBusy} type="submit">添加</button>
          </form>

          <div className={styles.creatorList}>
            {snapshot.creators.map((creator) => {
              const selected = selectedIds.includes(creator.id);
              return (
                <label className={`${styles.creatorRow} ${selected ? styles.creatorSelected : ""} ${creator.enabled ? "" : styles.creatorDisabled}`} key={creator.id}>
                  <input
                    checked={selected}
                    onChange={() => {
                      const nextIds = selected
                        ? selectedIds.filter((id) => id !== creator.id)
                        : [...selectedIds, creator.id];
                      void selectCreators(nextIds);
                    }}
                    type="checkbox"
                  />
                  <span
                    aria-hidden
                    className={styles.avatar}
                    style={creator.avatarUrl ? { backgroundImage: `url(${creator.avatarUrl})` } : undefined}
                  >
                    {creator.avatarUrl ? "" : creator.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={styles.creatorIdentity}>
                    <strong>{creator.displayName}</strong>
                    <small>
                      @{creator.handle} · {relativeTime(creator.lastSyncedAt)}
                      {!creator.enabled ? " · 已停用" : ""}
                    </small>
                  </span>
                  <button
                    className={styles.creatorToggle}
                    disabled={isBusy}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void toggleCreatorEnabled(creator);
                    }}
                    type="button"
                  >
                    {creator.enabled ? "停用" : "恢复"}
                  </button>
                  {creator.unreadCount ? <b className={styles.unreadBadge}>{creator.unreadCount}</b> : null}
                </label>
              );
            })}
            {!snapshot.creators.length ? <p className={styles.empty}>添加第一个交易博主开始监控。</p> : null}
          </div>

          <details className={styles.newDetails} open>
            <summary>新增推文 <span>{newPosts.length}</span></summary>
            <div>
              {newPosts.map((post) => (
                <button key={post.id} onClick={() => jumpToPost(post.id)} type="button">
                  <time>{postTime(post.publishedAt)}</time>
                  <span>{post.body.replace(/\s+/g, " ").slice(0, 58)}</span>
                </button>
              ))}
              {!newPosts.length ? <p className={styles.empty}>暂无新增推文。</p> : null}
            </div>
          </details>
        </aside>

        <section className={styles.feedPanel}>
          <div className={styles.feedToolbar}>
            <div>
              <span className={styles.kicker}>Live posts</span>
              <h2>推文时间线</h2>
            </div>
            <div className={styles.toolbarActions}>
              <div className={styles.segmented}>
                <button className={view === "new" ? styles.activeSegment : ""} onClick={() => setView("new")} type="button">新增</button>
                <button className={view === "all" ? styles.activeSegment : ""} onClick={() => setView("all")} type="button">全部</button>
              </div>
              <button className={styles.ghostButton} disabled={isBusy || !selectedIds.length} onClick={syncNow} type="button">立即刷新</button>
              <button className={styles.ghostButton} disabled={!newPosts.length} onClick={markAllRead} type="button">全部已读</button>
            </div>
          </div>

          <div className={styles.feedList}>
            {visiblePosts.map((post) => (
              <article
                className={`${styles.postCard} ${post.readAt ? styles.readPost : ""} ${highlightedId === post.id ? styles.highlightedPost : ""}`}
                key={post.id}
                onClick={() => void markRead(post.id)}
                ref={(node) => {
                  if (node) postRefs.current.set(post.id, node);
                  else postRefs.current.delete(post.id);
                }}
              >
                <div className={styles.postMeta}>
                  <strong>@{post.creator.handle}</strong>
                  <span>{post.postType === "quote" ? "引用" : "原创"}</span>
                  {post.isInitialImport ? <span>首次导入</span> : null}
                  <time>{postTime(post.publishedAt)}</time>
                </div>
                <p>{post.body}</p>
                <a href={post.sourceUrl} onClick={(event) => event.stopPropagation()} rel="noreferrer" target="_blank">查看原推 ↗</a>
              </article>
            ))}
            {!visiblePosts.length ? <p className={styles.emptyState}>当前筛选下没有推文。</p> : null}
          </div>
        </section>

        <aside className={styles.rightPanel}>
          <div className={styles.panelHead}>
            <div>
              <span className={styles.kicker}>AI digest</span>
              <h2>交易简报</h2>
            </div>
            <button className={styles.settingsButton} onClick={() => setStrategyOpen(true)} type="button">策略设置</button>
          </div>

          <div className={styles.integrationRow}>
            <span className={snapshot.integrations.xConfigured ? styles.integrationOk : styles.integrationOff}>X API</span>
            <span className={snapshot.integrations.aiConfigured ? styles.integrationOk : styles.integrationOff}>AI</span>
            <span className={snapshot.integrations.telegramConfigured ? styles.integrationOk : styles.integrationOff}>Telegram</span>
          </div>

          {!snapshot.integrations.aiConfigured ? (
            <div className={styles.notice}>AI 尚未配置。设置 OPENAI_API_KEY 后才会生成交易信号，不使用规则兜底。</div>
          ) : null}

          {snapshot.latestDigest ? (
            <>
              <section className={styles.summaryBlock}>
                <div className={styles.blockTitle}>
                  <h3>核心观点</h3>
                  <time>{relativeTime(snapshot.latestDigest.createdAt)}</time>
                </div>
                <ol>
                  {snapshot.latestDigest.digest.summary.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ol>
              </section>

              <section className={styles.signalStack}>
                <h3>交易信号</h3>
                {snapshot.latestDigest.digest.signals.map((signal, index) => (
                  <article className={styles.signalCard} key={`${signal.asset}-${index}`}>
                    <div className={styles.signalHead}>
                      <strong>{signal.asset}</strong>
                      <b data-direction={signal.direction}>{signal.direction}</b>
                    </div>
                    <span className={signal.strategyMatch === "CONFLICT" ? styles.conflictLabel : styles.matchLabel}>
                      {strategyLabel(signal.strategyMatch)}
                    </span>
                    <dl>
                      <div><dt>入场价</dt><dd>{signal.entryPrice}</dd></div>
                      <div><dt>入场时间</dt><dd>{signal.entryTiming}</dd></div>
                      <div><dt>失效条件</dt><dd>{signal.invalidation}</dd></div>
                    </dl>
                    <p>{signal.strategyReason}</p>
                    {signal.sourceUrls[0] ? <a href={signal.sourceUrls[0]} rel="noreferrer" target="_blank">来源推文 ↗</a> : null}
                  </article>
                ))}
                {!snapshot.latestDigest.digest.signals.length ? <p className={styles.empty}>这批推文没有明确交易信号。</p> : null}
              </section>
            </>
          ) : (
            <div className={styles.emptyDigest}>同步到推文后，这里会展示最多 3 条摘要和 3 个有原文证据的信号。</div>
          )}

          <button className={styles.analyzeButton} disabled={isBusy || !snapshot.integrations.aiConfigured || !selectedIds.length} onClick={analyzeAgain} type="button">
            {isBusy ? "处理中…" : "重新分析"}
          </button>
          <p className={styles.disclaimer}>仅整理博主公开表达，不构成投资建议或自动交易指令。</p>
        </aside>
      </section>

      {strategyOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setStrategyOpen(false)}>
          <section aria-modal="true" className={styles.modal} onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <span className={styles.kicker}>Strategy context · v{snapshot.strategy.version}</span>
            <h2>我的交易规则</h2>
            <p>AI 只判断信号是否符合或冲突，不会改写你的规则。</p>
            <textarea onChange={(event) => setStrategyDraft(event.target.value)} placeholder="例如：只在趋势确认后入场；不做逆势单；单笔风险不超过…" value={strategyDraft} />
            <div className={styles.modalActions}>
              <button className={styles.ghostButton} onClick={() => setStrategyOpen(false)} type="button">取消</button>
              <button className={styles.analyzeButton} disabled={isBusy} onClick={saveStrategy} type="button">保存规则</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
