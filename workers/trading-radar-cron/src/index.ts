export type CronEnv = {
  TRADING_RADAR_SYNC_URL?: string;
  CRON_SECRET?: string;
};

type SyncApiResponse = {
  ok?: boolean;
  status?: "success" | "partial" | "failed";
  total?: number;
  succeeded?: number;
  failed?: number;
  error?: string;
};

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function logFailure(message: string) {
  console.error(`[trading-radar-cron] ${message}`);
}

export async function runScheduledSync(env: CronEnv, fetcher: Fetcher = fetch): Promise<void> {
  const syncUrl = env.TRADING_RADAR_SYNC_URL?.trim();
  const secret = env.CRON_SECRET?.trim();

  if (!syncUrl || !secret) {
    logFailure("missing TRADING_RADAR_SYNC_URL or CRON_SECRET");
    throw new Error("Trading radar cron is not configured");
  }

  let response: Response;
  try {
    response = await fetcher(syncUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network failure";
    logFailure(`sync request failed: ${message}`);
    throw error;
  }

  const payload = (await response.json().catch(() => null)) as SyncApiResponse | null;
  if (!response.ok) {
    const detail = payload?.error ? `: ${payload.error}` : "";
    logFailure(`sync API returned status ${response.status}${detail}`);
    throw new Error(`Sync API returned ${response.status}${detail}`);
  }

  if (!payload || payload.ok !== true || payload.status !== "success") {
    if (payload?.status === "partial") {
      const failed = payload.failed ?? "unknown";
      const total = payload.total ?? "unknown";
      logFailure(`sync API reported partial success: ${failed} failed of ${total}`);
      throw new Error(`Sync API reported partial success: ${failed} failed of ${total}`);
    }
    logFailure("sync API returned an invalid result envelope");
    throw new Error("Invalid sync API response");
  }
}

const worker: ExportedHandler<CronEnv> = {
  async scheduled(_event, env): Promise<void> {
    await runScheduledSync(env);
  }
};

export default worker;
