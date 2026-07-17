import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTradingRadarSession, hasValidCronSecret } from "@/modules/trading-radar/route-auth";
import { summarizeCreatorSyncResults, syncWatchedCreators } from "@/modules/trading-radar/creator-sync";

export const runtime = "nodejs";

const syncSchema = z.object({ creatorIds: z.array(z.string()).max(100).optional() });

async function runSync(request: Request, body: unknown) {
  if (!hasValidCronSecret(request) && !(await hasTradingRadarSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid creator selection" }, { status: 400 });
  }
  try {
    const results = await syncWatchedCreators(parsed.data.creatorIds);
    const summary = summarizeCreatorSyncResults(results);
    return NextResponse.json(
      {
        ...summary,
        results,
        syncedAt: new Date().toISOString(),
        ...(summary.status === "failed" ? { error: "All enabled creator sync tasks failed" } : {})
      },
      { status: summary.status === "failed" ? 503 : 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Trading radar sync failed" },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  return runSync(request, await request.json().catch(() => ({})));
}

export async function GET(request: Request) {
  return runSync(request, {});
}
