/**
 * 报告转任务 HTTP 入口：POST 把一张 Opportunity Card 转成指定类型的 Output Asset。
 * 无状态——客户端回传机会卡子集与上下文，便于审核后再导出，不依赖 run 持久化。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateOpportunityAsset,
  getOutputTypesForVertical
} from "@/modules/deepsearch/asset-generator";

export const runtime = "nodejs";

const verticalSchema = z.enum([
  "ai_tattoo_generator",
  "ai_saas",
  "cross_border_ecommerce",
  "content_seo",
  "community_kol"
]);

const outputTypeSchema = z.enum([
  "seo_brief",
  "short_video",
  "pinterest_prompt",
  "kol_outreach",
  "markdown_report"
]);

const assetInputSchema = z.object({
  outputType: outputTypeSchema,
  opportunity: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    whyNow: z.string().min(1),
    audience: z.string().min(1),
    score: z.number().int().min(0).max(100),
    confidence: z.number().int().min(0).max(100),
    priority: z.enum(["high", "medium", "low"]),
    evidenceCount: z.number().int().min(0),
    growthActions: z.array(z.string()).max(12).default([]),
    sourceUrls: z.array(z.string()).max(40).default([])
  }),
  context: z.object({
    vertical: verticalSchema,
    seedKeywords: z.array(z.string().min(1)).max(16).optional(),
    painPoints: z.array(z.string().min(1)).max(16).optional(),
    productDirection: z.string().min(1).max(160).optional()
  })
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = assetInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { outputType, context } = parsed.data;
  const allowed = getOutputTypesForVertical(context.vertical);

  if (outputType !== "markdown_report" && !allowed.includes(outputType)) {
    return NextResponse.json(
      {
        error: `Output type "${outputType}" is not enabled for vertical "${context.vertical}"`,
        allowed
      },
      { status: 422 }
    );
  }

  const asset = generateOpportunityAsset(parsed.data);
  return NextResponse.json({ asset }, { status: 201 });
}
