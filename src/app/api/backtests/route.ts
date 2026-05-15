import { NextResponse } from "next/server";
import { z } from "zod";
import { runConnectorBacktest } from "@/modules/backtesting/run-backtest";

export const runtime = "nodejs";

const backtestInputSchema = z.object({
  productDirection: z.string().min(1).optional(),
  keywords: z.array(z.string().min(1)).min(1).max(12).optional(),
  limitPerSource: z.number().int().min(1).max(20).optional(),
  lookbackDays: z.number().int().min(1).max(365).optional(),
  sources: z.array(z.enum(["reddit", "etsy", "twitter"])).min(1).max(3).optional()
});

export async function GET() {
  const report = await runConnectorBacktest({
    limitPerSource: 4
  });

  return NextResponse.json({ report });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = backtestInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const report = await runConnectorBacktest(parsed.data);
  return NextResponse.json({ report });
}
