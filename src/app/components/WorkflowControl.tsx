"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const KEYWORD_PRESETS = {
  custom: {
    label: "自定义",
    keywords: "",
    productDirection: "Trading research"
  },
  trading: {
    label: "交易 · BTC & ETH",
    keywords: "比特币, 以太坊, bitcoin, ethereum, BTC, ETH",
    productDirection: "Crypto trading signals"
  },
  bitcoin: {
    label: "Bitcoin / 比特币",
    keywords: "比特币, bitcoin, BTC",
    productDirection: "Bitcoin trading opportunities"
  },
  ethereum: {
    label: "Ethereum / 以太坊",
    keywords: "以太坊, ethereum, ETH",
    productDirection: "Ethereum trading opportunities"
  }
} as const;

type PresetId = keyof typeof KEYWORD_PRESETS;

function parseKeywords(text: string) {
  return text
    .split(/[,，\n]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 8);
}

type WorkflowControlProps = {
  disabled?: boolean;
  dbError?: string | null;
  onRunningChange?: (running: boolean) => void;
};

export function WorkflowControl({ disabled = false, dbError = null, onRunningChange }: WorkflowControlProps) {
  const router = useRouter();
  const [preset, setPreset] = useState<PresetId>("trading");
  const [productDirection, setProductDirection] = useState<string>(KEYWORD_PRESETS.trading.productDirection);
  const [keywordText, setKeywordText] = useState<string>(KEYWORD_PRESETS.trading.keywords);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(nextPreset: PresetId) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      setKeywordText(KEYWORD_PRESETS[nextPreset].keywords);
      setProductDirection(KEYWORD_PRESETS[nextPreset].productDirection);
    }
  }

  async function runWorkflow() {
    const keywords = parseKeywords(keywordText);

    if (!keywords.length) {
      setError("请至少输入一个关键词");
      return;
    }

    setIsRunning(true);
    onRunningChange?.(true);
    setError(null);

    const response = await fetch("/api/workflow-runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productDirection: productDirection.trim() || `${keywords[0]} growth research`,
        keywords
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Workflow run failed");
      setIsRunning(false);
      onRunningChange?.(false);
      return;
    }

    router.refresh();
    // refresh 后 RSC 重取数据；短暂保留 Feed loading，避免列表瞬间闪回旧数据。
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsRunning(false);
    onRunningChange?.(false);
  }

  return (
    <div className="ds-input-stack">
      <label className="ds-field">
        <span>关键词预设</span>
        <select
          disabled={disabled || isRunning}
          onChange={(event) => applyPreset(event.target.value as PresetId)}
          value={preset}
        >
          {Object.entries(KEYWORD_PRESETS).map(([id, option]) => (
            <option key={id} value={id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="ds-field">
        <span>产品方向</span>
        <input
          disabled={disabled || isRunning}
          onChange={(event) => {
            setPreset("custom");
            setProductDirection(event.target.value);
          }}
          placeholder="例如：Crypto trading signals"
          value={productDirection}
        />
      </label>

      <label className="ds-field">
        <span>搜索关键词</span>
        <textarea
          disabled={disabled || isRunning}
          onChange={(event) => {
            setPreset("custom");
            setKeywordText(event.target.value);
          }}
          placeholder="用逗号或换行分隔，例如：比特币, 以太坊, bitcoin, ethereum"
          value={keywordText}
        />
      </label>

      <p className="ds-empty">数据源：X/Twitter · 未充值时自动 fallback 到 SoPilot RSS</p>

      <button
        className="ds-primary-btn"
        disabled={disabled || isRunning || !keywordText.trim()}
        onClick={runWorkflow}
        type="button"
      >
        {isRunning ? "Workflow running…" : "Run X Workflow"}
      </button>

      {dbError ? <p className="ds-warning">Database setup needed: {dbError}</p> : null}
      {error ? <p className="ds-warning">{error}</p> : null}
    </div>
  );
}
