import { NextResponse } from "next/server";
import { z } from "zod";
import { markCreatorPostsRead } from "@/modules/trading-radar/radar-service";
import { hasTradingRadarSession } from "@/modules/trading-radar/route-auth";

const inputSchema = z.object({ creatorIds: z.array(z.string()).min(1).max(100) });

export async function POST(request: Request) {
  if (!(await hasTradingRadarSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid creator selection" }, { status: 400 });
  }
  return NextResponse.json(await markCreatorPostsRead(parsed.data.creatorIds));
}
