/**
 * DeepSearch 历史列表：返回最近的 DeepSearch run 概要，供运营回看与详情下钻。
 */
import { NextResponse } from "next/server";
import {
  getDatabaseUnavailableMessage,
  isDatabaseReady
} from "@/lib/db-health";
import { listDeepSearchRuns } from "@/modules/deepsearch/persistence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isDatabaseReady())) {
    return NextResponse.json(
      { error: getDatabaseUnavailableMessage(), runs: [] },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), 50)
      : 10;

  try {
    const runs = await listDeepSearchRuns(limit);
    return NextResponse.json({ runs });
  } catch {
    return NextResponse.json(
      { error: "Failed to load DeepSearch runs", runs: [] },
      { status: 500 }
    );
  }
}
