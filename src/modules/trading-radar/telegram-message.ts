import type { TradingSignal } from "./trading-digest";

type TelegramDigestInput = {
  digestId: string;
  summary: string[];
  signals: TradingSignal[];
};

export function shouldDeliverTradingDigest(input: { trigger: "sync" | "manual"; isInitialImport: boolean }) {
  return input.trigger === "sync" && !input.isInitialImport;
}

function strategyLabel(match: TradingSignal["strategyMatch"]) {
  if (match === "MATCH") {
    return "✅ 符合策略";
  }

  if (match === "CONFLICT") {
    return "⚠️ 与策略冲突";
  }

  return "❔ 无法判断";
}

export function buildTelegramTradingMessage(input: TelegramDigestInput) {
  const signals = input.signals.filter((signal) => signal.direction !== "NONE").slice(0, 3);

  if (!signals.length) {
    return null;
  }

  const summary = input.summary.map((item) => `• ${item}`).join("\n");
  const signalBlocks = signals.map((signal) =>
    [
      `${strategyLabel(signal.strategyMatch)} · ${signal.asset} ${signal.direction}`,
      `入场价：${signal.entryPrice}`,
      `入场时间：${signal.entryTiming}`,
      `失效条件：${signal.invalidation}`,
      `原因：${signal.strategyReason}`,
      signal.sourceUrls[0] ?? ""
    ]
      .filter(Boolean)
      .join("\n")
  );

  return {
    idempotencyKey: `telegram:trading-digest:${input.digestId}`,
    text: ["交易博主雷达", summary, ...signalBlocks].filter(Boolean).join("\n\n")
  };
}
