import { NextResponse } from "next/server";
import { z } from "zod";
import { saveTradingStrategy } from "@/modules/trading-radar/digest-service";
import { hasTradingRadarSession } from "@/modules/trading-radar/route-auth";

const inputSchema = z.object({ content: z.string().max(10000) });

export async function PUT(request: Request) {
  if (!(await hasTradingRadarSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "交易规则内容无效" }, { status: 400 });
  }
  return NextResponse.json(await saveTradingStrategy(parsed.data.content));
}
