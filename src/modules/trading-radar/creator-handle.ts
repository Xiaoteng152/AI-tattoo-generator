const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;

function normalizeHandle(value: string) {
  const handle = value.replace(/^@/, "").trim();

  if (!HANDLE_PATTERN.test(handle)) {
    throw new Error("Invalid X creator handle");
  }

  return handle.toLowerCase();
}

export function parseXCreatorHandle(input: string) {
  const value = input.trim();

  if (!value) {
    throw new Error("Invalid X creator handle");
  }

  if (value.startsWith("@") || HANDLE_PATTERN.test(value)) {
    return normalizeHandle(value);
  }

  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Invalid X profile URL");
  }

  if (url.hostname !== "x.com" && url.hostname !== "www.x.com" && url.hostname !== "twitter.com" && url.hostname !== "www.twitter.com") {
    throw new Error("Invalid X profile URL");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 1) {
    throw new Error("X profile URL must point to a creator profile");
  }

  return normalizeHandle(parts[0]);
}
