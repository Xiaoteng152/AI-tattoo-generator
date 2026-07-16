type CronEnv = {
  TRADING_RADAR_SYNC_URL?: string;
  CRON_SECRET?: string;
};

function logFailure(message: string) {
  console.error(`[trading-radar-cron] ${message}`);
}

const worker = {
  async scheduled(_event: unknown, env: CronEnv): Promise<void> {
    const syncUrl = env.TRADING_RADAR_SYNC_URL?.trim();
    const secret = env.CRON_SECRET?.trim();

    if (!syncUrl || !secret) {
      logFailure("missing TRADING_RADAR_SYNC_URL or CRON_SECRET");
      throw new Error("Trading radar cron is not configured");
    }

    let response: Response;
    try {
      response = await fetch(syncUrl, {
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

    if (!response.ok) {
      logFailure(`sync API returned status ${response.status}`);
      throw new Error(`Sync API returned ${response.status}`);
    }
  }
};

export default worker;
