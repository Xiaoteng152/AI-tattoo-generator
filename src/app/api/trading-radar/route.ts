import { NextResponse } from "next/server";
import { getTradingRadarSnapshot } from "@/modules/trading-radar/radar-service";
import { hasTradingRadarSession } from "@/modules/trading-radar/route-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await hasTradingRadarSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const creatorIds = params.getAll("creatorId");
  try {
    return NextResponse.json(await getTradingRadarSnapshot(creatorIds));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load trading radar" },
      { status: 500 }
    );
  }
}
