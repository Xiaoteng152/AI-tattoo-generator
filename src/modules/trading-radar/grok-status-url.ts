const STATUS_URL_RE =
  /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/status\/(\d+)(?:[/?#].*)?$/i;

export type ParsedStatusUrl = {
  handle: string;
  statusId: string;
  canonicalUrl: string;
};

export function parseXStatusUrl(url: string): ParsedStatusUrl | null {
  const trimmed = url.trim();
  const match = STATUS_URL_RE.exec(trimmed);
  if (!match) {
    return null;
  }

  const handle = match[1];
  const statusId = match[2];
  return {
    handle,
    statusId,
    canonicalUrl: `https://x.com/${handle}/status/${statusId}`
  };
}

export function handlesMatch(left: string, right: string) {
  return left.replace(/^@/, "").toLowerCase() === right.replace(/^@/, "").toLowerCase();
}
