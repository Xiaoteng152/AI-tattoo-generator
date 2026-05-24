export type AuthConfigIssue =
  | "missing-auth-secret"
  | "missing-google-id"
  | "missing-google-secret";

export type AuthConfigStatus = {
  ready: boolean;
  issues: AuthConfigIssue[];
};

const PLACEHOLDER_PATTERNS = [
  /^your_/i,
  /^your-/i,
  /placeholder/i,
  /^replace/i,
  /^xxx+$/i
];

function isEmptyOrPlaceholder(value: string | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }

  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

export function getGoogleClientId(): string | undefined {
  const value =
    process.env.AUTH_GOOGLE_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim();
  return isEmptyOrPlaceholder(value) ? undefined : value;
}

export function getGoogleClientSecret(): string | undefined {
  const value =
    process.env.AUTH_GOOGLE_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim();
  return isEmptyOrPlaceholder(value) ? undefined : value;
}

export function getAuthConfigStatus(): AuthConfigStatus {
  const issues: AuthConfigIssue[] = [];

  if (isEmptyOrPlaceholder(process.env.AUTH_SECRET)) {
    issues.push("missing-auth-secret");
  }

  if (!getGoogleClientId()) {
    issues.push("missing-google-id");
  }

  if (!getGoogleClientSecret()) {
    issues.push("missing-google-secret");
  }

  return {
    ready: issues.length === 0,
    issues
  };
}

export const AUTH_CONFIG_ISSUE_MESSAGES: Record<AuthConfigIssue, string> = {
  "missing-auth-secret":
    "AUTH_SECRET 未设置。运行 `openssl rand -base64 32` 生成并写入 `.env.local`。",
  "missing-google-id":
    "AUTH_GOOGLE_ID（或 GOOGLE_CLIENT_ID）未设置。从 Google Cloud Console 复制 OAuth Client ID。",
  "missing-google-secret":
    "AUTH_GOOGLE_SECRET（或 GOOGLE_CLIENT_SECRET）未设置。从 Google Cloud Console 复制 Client Secret。"
};
