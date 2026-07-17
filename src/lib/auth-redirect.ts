const AUTH_REDIRECT_BASE = "https://auth.local";

export function getSafeAuthRedirect(
  value: unknown,
  fallback = "/trading-radar"
): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, AUTH_REDIRECT_BASE);
    if (parsed.origin !== AUTH_REDIRECT_BASE) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
