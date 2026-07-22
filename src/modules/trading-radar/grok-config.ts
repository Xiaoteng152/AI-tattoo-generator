export const GROK_MODEL = "grok-4.5";
export const GROK_REASONING_EFFORT = "medium";
export const GROK_PROMPT_VERSION = "trading-radar-grok-v1";
export const GROK_SOURCE_MODE = "grok-cli" as const;
export const GROK_CAPTURE_METHOD = "grok_cli_x_search";
export const GROK_BODY_LIMIT_BYTES = 512 * 1024;
export const GROK_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;
export const GROK_SEARCH_OVERLAP_MS = 6 * 60 * 60 * 1000;
export const GROK_MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_GROK_KEYWORDS = ["美股", "BTC"] as const;
export const DEFAULT_MAX_CREATORS = 4;
export const DEFAULT_MAX_RUNS_PER_WINDOW = 21;
export const DEFAULT_MAX_FINDINGS = 12;
export const DEFAULT_MAX_FINDINGS_PER_ACCOUNT = 3;
export const DEFAULT_WEEKLY_RESET_ANCHOR = "2026-07-29T03:25:00Z";

export function getTradingRadarSource() {
  return (process.env.TRADING_RADAR_SOURCE?.trim() || "x-api").toLowerCase();
}

export function isGrokCliSource() {
  return getTradingRadarSource() === GROK_SOURCE_MODE;
}

export function getGrokIngestSecret() {
  return process.env.GROK_INGEST_SECRET?.trim() || "";
}

export function getGrokMaxCreators() {
  const value = Number(process.env.GROK_RADAR_MAX_CREATORS ?? DEFAULT_MAX_CREATORS);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), DEFAULT_MAX_CREATORS) : DEFAULT_MAX_CREATORS;
}

export function getGrokMaxRunsPerWindow() {
  const value = Number(process.env.GROK_RADAR_MAX_RUNS_PER_WINDOW ?? DEFAULT_MAX_RUNS_PER_WINDOW);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_MAX_RUNS_PER_WINDOW;
}

export function getGrokKeywords() {
  const raw = process.env.GROK_RADAR_KEYWORDS?.trim();
  if (!raw) {
    return [...DEFAULT_GROK_KEYWORDS];
  }

  const keywords = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return keywords.length ? keywords : [...DEFAULT_GROK_KEYWORDS];
}

export function getGrokWeeklyResetAnchor(now = new Date()) {
  const raw = process.env.GROK_WEEKLY_RESET_ANCHOR?.trim() || DEFAULT_WEEKLY_RESET_ANCHOR;
  const anchor = new Date(raw);
  if (Number.isNaN(anchor.getTime())) {
    throw new Error(`Invalid GROK_WEEKLY_RESET_ANCHOR: ${raw}`);
  }
  if (anchor.getTime() > now.getTime() + GROK_MAX_LOOKBACK_MS) {
    throw new Error("GROK_WEEKLY_RESET_ANCHOR is too far in the future");
  }
  return anchor;
}
