import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateTradingDigest } from "@/modules/trading-radar/digest-service";
import { isGrokCliSource } from "@/modules/trading-radar/grok-config";
import { hasTradingRadarSession } from "@/modules/trading-radar/route-auth";

export const runtime = "nodejs";

const inputSchema = z.object({
  creatorIds: z.array(z.string()).min(1).max(100),
  force: z.boolean().optional()
});

export async function POST(request: Request) {
  if (!(await hasTradingRadarSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isGrokCliSource()) {
    return NextResponse.json(
      {
        error: "Grok 模式下摘要由采集写入，不支持重新分析",
        sourceMode: "grok-cli"
      },
      { status: 409 }
    );
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid digest selection" }, { status: 400 });
  }
  try {
    const result = await getOrCreateTradingDigest(parsed.data.creatorIds, {
      force: parsed.data.force,
      trigger: "manual"
    });
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trading analysis failed";
    const status = /AI 未配置/.test(message) ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
