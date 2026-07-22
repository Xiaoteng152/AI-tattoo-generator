const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;

export type ParsedCreatorHandle = {
  handle: string;
  displayHandle: string;
};

function stripAt(value: string) {
  return value.replace(/^@/, "").trim();
}

function toParsedHandle(raw: string): ParsedCreatorHandle {
  const displayHandle = stripAt(raw);
  if (!HANDLE_PATTERN.test(displayHandle)) {
    throw new Error("Invalid X creator handle");
  }

  return {
    handle: displayHandle.toLowerCase(),
    displayHandle
  };
}

export function parseXCreatorHandle(input: string) {
  return parseXCreatorInput(input).handle;
}

export function parseXCreatorInput(input: string): ParsedCreatorHandle {
  const value = input.trim();

  if (!value) {
    throw new Error("Invalid X creator handle");
  }

  if (value.startsWith("@") || HANDLE_PATTERN.test(value)) {
    return toParsedHandle(value);
  }

  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Invalid X profile URL");
  }

  if (
    url.hostname !== "x.com" &&
    url.hostname !== "www.x.com" &&
    url.hostname !== "twitter.com" &&
    url.hostname !== "www.twitter.com"
  ) {
    throw new Error("Invalid X profile URL");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 1) {
    throw new Error("X profile URL must point to a creator profile");
  }

  return toParsedHandle(parts[0]);
}
