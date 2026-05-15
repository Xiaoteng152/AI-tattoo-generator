import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runMvpWorkflow } from "@/modules/workflow/run-workflow";

export const runtime = "nodejs";

export async function GET() {
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

export async function POST() {
  try {
    const run = await runMvpWorkflow();
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
