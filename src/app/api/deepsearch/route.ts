import { NextResponse } from "next/server";
import { z } from "zod";
import { runDeepSearchAgent } from "@/modules/deepsearch/runner";

export const runtime = "nodejs";

const deepSearchInputSchema = z.object({
  goal: z.string().min(1).optional(),
  audience: z.string().min(1).optional(),
  seedKeywords: z.array(z.string().min(1)).min(1).max(12).optional(),
  limitPerSource: z.number().int().min(1).max(10).optional(),
  lookbackDays: z.number().int().min(1).max(365).optional()
});

export async function GET() {
  const result = await runDeepSearchAgent({
    limitPerSource: 2
  });

  return NextResponse.json({ result });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = deepSearchInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await runDeepSearchAgent(parsed.data);
  return NextResponse.json({ result }, { status: result.state.status === "failed" ? 500 : 201 });
}
