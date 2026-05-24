/**
 * DeepSearch HTTP 入口：POST 触发完整 pipeline，GET 提供默认可演示查询。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
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

async function requireSession() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** 开发/冒烟：固定 AI tattoo 示例问题 */
export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const result = await runDeepSearchAgent({
    query: "Find growth opportunities for AI tattoo generator around fine line tattoo ideas",
    limitPerSource: 2,
    depth: "standard"
  });

  return NextResponse.json({ result });
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => ({}));
  const parsed = deepSearchInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await runDeepSearchAgent(parsed.data);
  return NextResponse.json(
    { result },
    { status: result.state.status === "failed" ? 500 : 201 }
  );
}
