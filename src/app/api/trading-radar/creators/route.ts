import { NextResponse } from "next/server";
import { z } from "zod";
import { addWatchedCreator } from "@/modules/trading-radar/radar-service";
import { hasTradingRadarSession } from "@/modules/trading-radar/route-auth";

export const runtime = "nodejs";

const inputSchema = z.object({ input: z.string().min(1).max(200) });

export async function POST(request: Request) {
  if (!(await hasTradingRadarSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "请输入有效的 @handle 或 X 主页链接" }, { status: 400 });
  }

  try {
    return NextResponse.json(await addWatchedCreator(parsed.data.input), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add creator";
    const status = /not found|invalid|profile|handle/i.test(message) ? 400 : /X API 未配置/.test(message) ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
