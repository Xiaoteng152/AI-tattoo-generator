import { NextResponse } from "next/server";
import { markCreatorPostRead } from "@/modules/trading-radar/radar-service";
import { hasTradingRadarSession } from "@/modules/trading-radar/route-auth";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await hasTradingRadarSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  return NextResponse.json(await markCreatorPostRead(id));
}
