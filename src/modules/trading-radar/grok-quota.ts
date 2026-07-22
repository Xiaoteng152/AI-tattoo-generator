import { GROK_MAX_LOOKBACK_MS, getGrokWeeklyResetAnchor } from "./grok-config";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type QuotaWindow = {
  start: Date;
  end: Date;
  resetsAt: Date;
};

export function getQuotaWindow(now = new Date(), anchor = getGrokWeeklyResetAnchor(now)): QuotaWindow {
  const elapsed = now.getTime() - anchor.getTime();
  const index = Math.floor(elapsed / WEEK_MS);
  const start = new Date(anchor.getTime() + index * WEEK_MS);
  const end = new Date(start.getTime() + WEEK_MS);
  return { start, end, resetsAt: end };
}

export function computeSearchWindow(input: {
  now?: Date;
  lastSucceededUntil?: Date | null;
}) {
  const now = input.now ?? new Date();
  const maxStart = new Date(now.getTime() - GROK_MAX_LOOKBACK_MS);

  if (!input.lastSucceededUntil) {
    return { since: maxStart, until: now };
  }

  const overlapped = new Date(input.lastSucceededUntil.getTime() - 6 * 60 * 60 * 1000);
  const since = overlapped.getTime() < maxStart.getTime() ? maxStart : overlapped;
  return { since, until: now };
}

/** Daily slots in UTC: 00:30 / 06:30 / 12:30 ≈ Asia/Shanghai 08:30 / 14:30 / 20:30 */
export const GROK_DAILY_UTC_SLOTS = [
  { hour: 0, minute: 30 },
  { hour: 6, minute: 30 },
  { hour: 12, minute: 30 }
] as const;

export function nextScheduledRunAt(now = new Date()) {
  const candidates: Date[] = [];
  for (let dayOffset = 0; dayOffset < 3; dayOffset += 1) {
    for (const slot of GROK_DAILY_UTC_SLOTS) {
      const candidate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + dayOffset,
        slot.hour,
        slot.minute,
        0,
        0
      ));
      if (candidate.getTime() > now.getTime()) {
        candidates.push(candidate);
      }
    }
  }
  return candidates[0] ?? null;
}
