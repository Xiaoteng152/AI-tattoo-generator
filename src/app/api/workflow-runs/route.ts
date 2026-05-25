import { NextResponse } from "next/server";
import { z } from "zod";
import { clearDatabaseAvailabilityCache, isDatabaseReady, getDatabaseUnavailableMessage } from "@/lib/db-health";
import { prisma } from "@/lib/prisma";
import { runMvpWorkflow } from "@/modules/workflow/run-workflow";

export const runtime = "nodejs";

const workflowRunInputSchema = z.object({
  productDirection: z.string().min(1).max(120).optional(),
  keywords: z.array(z.string().min(1)).min(1).max(8).optional()
});

export async function GET() {
  if (!(await isDatabaseReady())) {
    return NextResponse.json({ error: getDatabaseUnavailableMessage(), runs: [] }, { status: 503 });
  }

  const runs = await prisma.workflowRun.findMany({
    orderBy: {
      startedAt: "desc"
    },
    take: 10,
    include: {
      workflowConfig: true,
      steps: true,
      opportunities: {
        orderBy: {
          score: "desc"
        }
      },
      outputAssets: true
    }
  });

  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  try {
    if (!(await isDatabaseReady())) {
      return NextResponse.json({ error: getDatabaseUnavailableMessage() }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = workflowRunInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const run = await runMvpWorkflow(parsed.data);
    clearDatabaseAvailabilityCache();
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow run failed";
    // 把 X API 鉴权/套餐问题映射为 402，网络/代理问题映射为 503，便于前端展示。
    const status =
      /Bearer Token is invalid|401 Unauthorized|402 Payment Required|no API credits|403 Forbidden|lack access to search/i.test(message)
        ? 402
        : /Cannot reach api\.x\.com|Cannot reach https:\/\/api\.x\.com|fetch failed|HTTPS_PROXY|VPN/i.test(message)
          ? 503
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
