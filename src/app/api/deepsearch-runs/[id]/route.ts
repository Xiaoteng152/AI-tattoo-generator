/**
 * DeepSearch 历史详情：按 run id 返回 plan、questions、evidence bundles 与 report。
 */
import { NextResponse } from "next/server";
import {
  getDatabaseUnavailableMessage,
  isDatabaseReady
} from "@/lib/db-health";
import { getDeepSearchRunDetail } from "@/modules/deepsearch/persistence";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isDatabaseReady())) {
    return NextResponse.json(
      { error: getDatabaseUnavailableMessage() },
      { status: 503 }
    );
  }

  const { id } = await context.params;

  try {
    const run = await getDeepSearchRunDetail(id);

    if (!run) {
      return NextResponse.json(
        { error: `DeepSearch run "${id}" was not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ run });
  } catch {
    return NextResponse.json(
      { error: "Failed to load DeepSearch run detail" },
      { status: 500 }
    );
  }
}
