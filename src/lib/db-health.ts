import net from "node:net";
import { prisma } from "@/lib/prisma";

type DatabaseTarget = {
  host: string;
  port: number;
};

const availabilityCache = {
  value: null as boolean | null,
  expiresAt: 0
};

const DEFAULT_PROBE_TIMEOUT_MS = Number(process.env.DATABASE_PROBE_TIMEOUT_MS ?? 2500);
const AVAILABILITY_CACHE_MS = 10_000;

type DatabaseFailureReason = "missing_url" | "tcp_unreachable" | "query_timeout" | "query_failed";

const lastFailureReason: { value: DatabaseFailureReason | null } = { value: null };

function parseDatabaseTarget(): DatabaseTarget {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return { host: "localhost", port: 5432 };
  }

  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname || "localhost",
      port: Number(url.port || 5432)
    };
  } catch {
    return { host: "localhost", port: 5432 };
  }
}

function setAvailabilityCache(value: boolean, reason: DatabaseFailureReason | null = null) {
  availabilityCache.value = value;
  availabilityCache.expiresAt = Date.now() + AVAILABILITY_CACHE_MS;
  lastFailureReason.value = value ? null : reason;
}

export function getDatabaseUnavailableMessage() {
  const target = parseDatabaseTarget();

  if (lastFailureReason.value === "query_timeout") {
    return `Database at ${target.host}:${target.port} is reachable but responded slowly. Retry in a moment, or increase DATABASE_PROBE_TIMEOUT_MS.`;
  }

  if (lastFailureReason.value === "query_failed") {
    return `Database at ${target.host}:${target.port} rejected the connection. Check DATABASE_URL / DIRECT_URL credentials and Supabase project status.`;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return "DATABASE_URL is not set. Copy .env.example to .env.local, start PostgreSQL, then run npm run db:migrate.";
  }

  return `PostgreSQL is not reachable at ${target.host}:${target.port}. Start the database, then run npm run db:migrate.`;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function canReachDatabase(timeoutMs = 1000): Promise<boolean> {
  const target = parseDatabaseTarget();

  return new Promise((resolve) => {
    const socket = net.createConnection(target);
    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function isDatabaseReady(
  probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS
): Promise<boolean> {
  const now = Date.now();
  if (availabilityCache.value !== null && now < availabilityCache.expiresAt) {
    return availabilityCache.value;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    setAvailabilityCache(false, "missing_url");
    return false;
  }

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, probeTimeoutMs);
    setAvailabilityCache(true);
    return true;
  } catch (error) {
    const reason = error instanceof Error && error.message === "timeout" ? "query_timeout" : "query_failed";
    setAvailabilityCache(false, reason);
    return false;
  }
}

export function clearDatabaseAvailabilityCache() {
  availabilityCache.value = null;
  availabilityCache.expiresAt = 0;
  lastFailureReason.value = null;
}
