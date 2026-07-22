import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeGrokReserve, GrokAuthError } from "@/modules/trading-radar/grok-auth";
import { GrokReserveError, reserveGrokRun } from "@/modules/trading-radar/grok-reserve";

export const runtime = "nodejs";

const bodySchema = z.object({
  runId: z.string().trim().min(8).max(120)
});

export async function POST(request: Request) {
  try {
    const rawBody = await authorizeGrokReserve(request);
    const parsed = bodySchema.safeParse(JSON.parse(rawBody || "{}"));
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_run_id" }, { status: 400 });
    }

    const config = await reserveGrokRun(parsed.data.runId);
    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof GrokAuthError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    if (error instanceof GrokReserveError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    return NextResponse.json({ error: "reserve_failed" }, { status: 500 });
  }
}
