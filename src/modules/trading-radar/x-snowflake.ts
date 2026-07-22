/** X/Twitter Snowflake epoch (ms): 2010-11-04T01:42:54.657Z */
export const X_SNOWFLAKE_EPOCH_MS = 1_288_834_974_657;

/** Allow model-declared publishedAt to drift from snowflake by this much. */
export const STATUS_TIMESTAMP_TOLERANCE_MS = 24 * 60 * 60 * 1000;

export function decodeXStatusTimestamp(statusId: string): Date | null {
  if (!/^\d{5,25}$/.test(statusId)) {
    return null;
  }

  try {
    const createdAtMs = Number(BigInt(statusId) / BigInt(4_194_304)) + X_SNOWFLAKE_EPOCH_MS;
    if (!Number.isFinite(createdAtMs) || createdAtMs < X_SNOWFLAKE_EPOCH_MS) {
      return null;
    }
    return new Date(createdAtMs);
  } catch {
    return null;
  }
}

export function isTimestampWithinWindow(
  value: Date,
  window: { since: Date; until: Date }
) {
  const ms = value.getTime();
  return ms >= window.since.getTime() && ms <= window.until.getTime();
}

export function timestampsAgree(
  left: Date,
  right: Date,
  toleranceMs = STATUS_TIMESTAMP_TOLERANCE_MS
) {
  return Math.abs(left.getTime() - right.getTime()) <= toleranceMs;
}
