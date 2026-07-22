import { createHmac, timingSafeEqual } from "node:crypto";
import {
  GROK_BODY_LIMIT_BYTES,
  GROK_TIMESTAMP_SKEW_MS,
  getGrokIngestSecret
} from "./grok-config";

export type GrokAuthFailure =
  | "missing_secret"
  | "invalid_signature"
  | "invalid_timestamp"
  | "body_too_large";

export class GrokAuthError extends Error {
  readonly code: GrokAuthFailure;
  readonly status: number;

  constructor(code: GrokAuthFailure, status = 401) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || "";
}

export function assertGrokBearer(request: Request) {
  const secret = getGrokIngestSecret();
  if (!secret || secret.length < 32) {
    throw new GrokAuthError("missing_secret", 503);
  }

  const token = readBearerToken(request);
  if (!token || token.length !== secret.length) {
    throw new GrokAuthError("invalid_signature");
  }

  const left = Buffer.from(token);
  const right = Buffer.from(secret);
  if (!timingSafeEqual(left, right)) {
    throw new GrokAuthError("invalid_signature");
  }
}

export function parseGrokTimestamp(headerValue: string | null, now = Date.now()) {
  if (!headerValue?.trim()) {
    throw new GrokAuthError("invalid_timestamp");
  }

  const asNumber = Number(headerValue);
  const millis = Number.isFinite(asNumber)
    ? asNumber < 1e12
      ? asNumber * 1000
      : asNumber
    : Date.parse(headerValue);

  if (!Number.isFinite(millis)) {
    throw new GrokAuthError("invalid_timestamp");
  }

  if (Math.abs(now - millis) > GROK_TIMESTAMP_SKEW_MS) {
    throw new GrokAuthError("invalid_timestamp");
  }

  return millis;
}

export function signGrokBody(secret: string, timestamp: string, rawBody: string) {
  return createHmac("sha256", secret).update(`${timestamp}\n${rawBody}`).digest("hex");
}

export function assertGrokSignature(request: Request, rawBody: string, timestamp: string) {
  const secret = getGrokIngestSecret();
  if (!secret || secret.length < 32) {
    throw new GrokAuthError("missing_secret", 503);
  }

  const header = request.headers.get("x-grok-signature")?.trim() || "";
  const provided = header.replace(/^sha256=/i, "").trim().toLowerCase();
  const expected = signGrokBody(secret, timestamp, rawBody);

  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new GrokAuthError("invalid_signature");
  }
}

export async function readGrokRawBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > GROK_BODY_LIMIT_BYTES) {
    throw new GrokAuthError("body_too_large", 413);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > GROK_BODY_LIMIT_BYTES) {
    throw new GrokAuthError("body_too_large", 413);
  }

  return rawBody;
}

export async function authorizeGrokIngest(request: Request) {
  assertGrokBearer(request);
  const timestampHeader = request.headers.get("x-grok-timestamp");
  parseGrokTimestamp(timestampHeader);
  const rawBody = await readGrokRawBody(request);
  assertGrokSignature(request, rawBody, timestampHeader!.trim());
  return rawBody;
}

export async function authorizeGrokReserve(request: Request) {
  assertGrokBearer(request);
  parseGrokTimestamp(request.headers.get("x-grok-timestamp"));
  return readGrokRawBody(request);
}
