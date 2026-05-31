/**
 * 报告转任务（Output Asset 生成）：把 Synthesis 产出的 Opportunity Card 一键转成
 * 运营可审核的资产 —— SEO brief、短视频选题、Pinterest/素材 Prompt、KOC/KOL 触达。
 *
 * MVP 为规则化的确定性模板（无 LLM），但每个资产都锚定机会卡证据 URL，便于人工核实。
 * 触达类资产强制保留 review gate，禁止自动发送。
 */
import { getVerticalConfig } from "./config/verticals";
import type {
  AssetGenerationContext,
  AssetOpportunity,
  DeepSearchAsset,
  DeepSearchOutputType,
  VerticalId
} from "./types";

/** 每个垂类默认可转换的 Output Asset 类型，供 UI 渲染按钮 */
const outputTypesByVertical: Record<VerticalId, DeepSearchOutputType[]> = {
  ai_tattoo_generator: ["seo_brief", "short_video", "pinterest_prompt"],
  cross_border_ecommerce: ["pinterest_prompt", "short_video", "seo_brief"],
  ai_saas: ["seo_brief", "short_video"],
  content_seo: ["seo_brief", "short_video"],
  community_kol: ["kol_outreach", "short_video"]
};

const outputTypeLabels: Record<DeepSearchOutputType, string> = {
  seo_brief: "SEO Brief",
  short_video: "Short Video Idea",
  pinterest_prompt: "Image / Pinterest Prompt",
  kol_outreach: "KOC/KOL Outreach",
  markdown_report: "Markdown Report"
};

export function getOutputTypesForVertical(
  vertical: VerticalId
): DeepSearchOutputType[] {
  return outputTypesByVertical[vertical] ?? ["seo_brief", "short_video"];
}

export function getOutputTypeLabel(outputType: DeepSearchOutputType): string {
  return outputTypeLabels[outputType];
}

function makeAssetId(opportunityId: string, outputType: DeepSearchOutputType) {
  return `asset_${outputType}_${opportunityId}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function bulletList(items: string[], fallback: string): string {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);

  if (!cleaned.length) {
    return `- ${fallback}`;
  }

  return cleaned.map((item) => `- ${item}`).join("\n");
}

function resolveProductDirection(
  context: AssetGenerationContext
): string {
  if (context.productDirection?.trim()) {
    return context.productDirection.trim();
  }

  return getVerticalConfig(context.vertical).name;
}

function resolveKeywords(
  context: AssetGenerationContext
): string[] {
  if (context.seedKeywords?.length) {
    return context.seedKeywords;
  }

  return getVerticalConfig(context.vertical).seedKeywords.slice(0, 4);
}

function metaLine(opportunity: AssetOpportunity): string {
  return `> priority **${opportunity.priority}** · score ${opportunity.score}/100 · confidence ${opportunity.confidence}% · evidence ${opportunity.evidenceCount}`;
}

function sourcesSection(opportunity: AssetOpportunity): string {
  const urls = Array.from(new Set(opportunity.sourceUrls.filter(Boolean)));

  if (!urls.length) {
    return "## Evidence\n\n- No source URLs were attached to this opportunity; verify before publishing.";
  }

  return `## Evidence\n\n${urls.map((url) => `- ${url}`).join("\n")}`;
}

function buildSeoBrief(
  opportunity: AssetOpportunity,
  context: AssetGenerationContext
): string {
  const productDirection = resolveProductDirection(context);
  const keywords = resolveKeywords(context);

  return [
    `# SEO Brief: ${opportunity.title}`,
    "",
    metaLine(opportunity),
    "",
    "## Why now",
    "",
    opportunity.whyNow,
    "",
    "## Search intent & target keywords",
    "",
    bulletList(
      keywords.map((keyword) => `${keyword} — map to informational + commercial intent`),
      "Cluster the matched query themes into one primary and two supporting keywords."
    ),
    "",
    "## Audience pain points to address",
    "",
    bulletList(
      context.painPoints ?? [],
      "Turn the strongest evidence snippet into a concrete user concern before writing."
    ),
    "",
    "## Recommended page outline",
    "",
    `1. Restate the exact concern behind "${opportunity.title}" in plain language.`,
    "2. Explain why this is trending now and who is driving the conversation.",
    `3. Give 3 practical recommendations tied to ${productDirection}, grounded in the evidence below.`,
    "4. Add proof points, comparisons or risk notes that reduce decision uncertainty.",
    "5. Close with a CTA aligned to the search intent.",
    "",
    sourcesSection(opportunity)
  ].join("\n");
}

function buildShortVideo(
  opportunity: AssetOpportunity,
  context: AssetGenerationContext
): string {
  const productDirection = resolveProductDirection(context);

  return [
    `# Short Video Idea: ${opportunity.title}`,
    "",
    metaLine(opportunity),
    "",
    "## Hook options",
    "",
    bulletList(
      [
        `"${opportunity.title}" — open with the pain in the first 2 seconds`,
        "Contrarian take that challenges the obvious assumption",
        "Before / after framing using a real example"
      ],
      "Lead with the strongest user pain in the first 2 seconds."
    ),
    "",
    "## 30-60s script outline",
    "",
    "1. Hook: name the problem the audience already feels.",
    `2. Context: why ${productDirection} makes this easier now.`,
    "3. Payoff: 3 fast tips or a quick demo grounded in the evidence.",
    "4. CTA: tell viewers the one next action to take.",
    "",
    "## On-screen / b-roll",
    "",
    bulletList(
      opportunity.growthActions,
      "Use screen capture of the workflow plus captions of the key claim."
    ),
    "",
    `## Audience\n\n${opportunity.audience}`,
    "",
    sourcesSection(opportunity)
  ].join("\n");
}

function buildPinterestPrompt(
  opportunity: AssetOpportunity,
  context: AssetGenerationContext
): string {
  const keywords = resolveKeywords(context);
  const styleWords = keywords.slice(0, 3).join(", ") || "minimal, clean, high contrast";

  return [
    `# Image / Pinterest Prompt: ${opportunity.title}`,
    "",
    metaLine(opportunity),
    "",
    `## Board theme\n\n${opportunity.whyNow}`,
    "",
    "## Image prompts",
    "",
    bulletList(
      keywords.map(
        (keyword) =>
          `${keyword}, ${styleWords}, clean background, high detail, cohesive palette --ar 2:3`
      ),
      `${opportunity.title}, ${styleWords}, clean background, high detail --ar 2:3`
    ),
    "",
    "## Pin copy & alt text",
    "",
    `- Pin title: ${opportunity.title}`,
    `- Description: ${opportunity.whyNow}`,
    `- Alt text: visual concept for ${opportunity.title} aimed at ${opportunity.audience}.`,
    "",
    sourcesSection(opportunity)
  ].join("\n");
}

function buildKolOutreach(
  opportunity: AssetOpportunity,
  context: AssetGenerationContext
): string {
  const productDirection = resolveProductDirection(context);

  return [
    `# KOC/KOL Outreach: ${opportunity.title}`,
    "",
    metaLine(opportunity),
    "",
    "> Review gate: this draft must be approved by an operator before any send. No auto-send.",
    "",
    `## Target creator profile\n\n${opportunity.audience}`,
    "",
    `## Why reach out now\n\n${opportunity.whyNow}`,
    "",
    "## Outreach message draft",
    "",
    "```text",
    `Hi {{creator}},`,
    "",
    `I noticed your content around ${opportunity.title.toLowerCase()} — it lines up with what your audience keeps asking for.`,
    `We're building ${productDirection} and would love to share early access plus a collab angle that fits your style.`,
    "Worth a quick chat this week?",
    "```",
    "",
    "## Follow-up",
    "",
    bulletList(
      opportunity.growthActions,
      "Send one value-add follow-up after 3 days if there is no reply."
    ),
    "",
    sourcesSection(opportunity)
  ].join("\n");
}

const builders: Record<
  DeepSearchOutputType,
  (opportunity: AssetOpportunity, context: AssetGenerationContext) => string
> = {
  seo_brief: buildSeoBrief,
  short_video: buildShortVideo,
  pinterest_prompt: buildPinterestPrompt,
  kol_outreach: buildKolOutreach,
  // markdown_report 在报告层整体导出，这里以机会卡摘要兜底
  markdown_report: (opportunity, context) => buildSeoBrief(opportunity, context)
};

export type GenerateAssetInput = {
  opportunity: AssetOpportunity;
  outputType: DeepSearchOutputType;
  context: AssetGenerationContext;
};

/** 把单张机会卡转成指定类型的 Output Asset */
export function generateOpportunityAsset(
  input: GenerateAssetInput
): DeepSearchAsset {
  const { opportunity, outputType, context } = input;
  const build = builders[outputType];
  const content = build(opportunity, context);

  return {
    id: makeAssetId(opportunity.id, outputType),
    opportunityId: opportunity.id,
    outputType,
    title: `${outputTypeLabels[outputType]}: ${opportunity.title}`,
    format: "markdown",
    content,
    sourceUrls: Array.from(new Set(opportunity.sourceUrls.filter(Boolean))),
    reviewGate: outputType === "kol_outreach",
    createdAt: new Date().toISOString()
  };
}
