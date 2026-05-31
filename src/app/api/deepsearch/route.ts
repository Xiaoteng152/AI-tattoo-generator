/**
 * DeepSearch HTTP 入口：POST 触发完整 pipeline，GET 提供默认可演示查询。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { persistDeepSearchResult } from "@/modules/deepsearch/persistence";
import { runDeepSearchAgent } from "@/modules/deepsearch/runner";

export const runtime = "nodejs";

const deepSearchInputSchema = z.object({
  query: z.string().min(1).optional(),
  goal: z.string().min(1).optional(),
  audience: z.string().min(1).optional(),
  vertical: z
    .enum([
      "ai_tattoo_generator",
      "ai_saas",
      "cross_border_ecommerce",
      "content_seo",
      "community_kol"
    ])
    .optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional(),
  targetMarket: z.string().min(1).max(40).optional(),
  timeRange: z
    .enum(["last_7_days", "last_30_days", "last_90_days", "any"])
    .optional(),
  seedKeywords: z.array(z.string().min(1)).min(1).max(12).optional(),
  requiredSources: z
    .array(
      z.enum([
        "reddit",
        "etsy",
        "twitter",
        "pinterest",
        "youtube",
        "tiktok",
        "seo",
        "google_trends"
      ])
    )
    .max(8)
    .optional(),
  limitPerSource: z.number().int().min(1).max(10).optional(),
  lookbackDays: z.number().int().min(1).max(365).optional()
});

/** 开发/冒烟：固定 AI tattoo 示例问题 */
export async function GET() {
  const query =
    "Find growth opportunities for AI tattoo generator around fine line tattoo ideas";
  const result = await runDeepSearchAgent({
    query,
    limitPerSource: 2,
    depth: "standard"
  });

  const runId = await persistDeepSearchResult({ query, result });
  return NextResponse.json({ runId, result });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = deepSearchInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await runDeepSearchAgent(parsed.data);
  const query =
    parsed.data.query ?? parsed.data.goal ?? result.plan.goal;
  // 最佳努力持久化：DB 不可用时 runId 为 null，不影响返回报告
  const runId = await persistDeepSearchResult({ query, result });

  return NextResponse.json(
    { runId, result },
    { status: result.state.status === "failed" ? 500 : 201 }
  );
}
