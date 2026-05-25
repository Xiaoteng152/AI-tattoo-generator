type MarkdownOpportunity = {
  title: string;
  type: string;
  score: number;
  confidence: number;
  evidenceSummary: string;
  sourceUrls: string[];
  recommendedAct: string;
};

type SeoBriefContext = {
  productDirection?: string;
  keywords?: string[];
  painPoints?: string[];
};

function truncate(text: string, maxLength: number) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

export function generateSeoBriefMarkdown(opportunity: MarkdownOpportunity, context: SeoBriefContext = {}) {
  const sourceLinks = opportunity.sourceUrls.map((url) => `- ${url}`).join("\n");
  const keywordLine = context.keywords?.length ? context.keywords.join(", ") : "Use the matched query themes from the X signal.";
  const painLine = context.painPoints?.length
    ? context.painPoints.map((point) => `- ${point}`).join("\n")
    : "- Turn the post into a concrete user concern before writing the page.";
  const productDirection = context.productDirection ?? "the product";

  return `# SEO Brief: ${truncate(opportunity.title, 96)}

## X Signal

${opportunity.evidenceSummary}

## Opportunity Snapshot

- Type: ${opportunity.type}
- Score: ${opportunity.score}/100
- Confidence: ${opportunity.confidence}%

## Why This Matters

This brief is grounded in a real X/Twitter post, not a generic template. The post signal should be interpreted in the context of **${productDirection}**, then turned into an operator-ready action plan.

## Audience Pain Points

${painLine}

## Keywords To Target

${keywordLine}

## Recommended Page Outline

1. Quote or restate the exact concern from the X post in plain language.
2. Explain why this topic is trending now and who is driving the conversation.
3. Give 3 practical recommendations tied to ${productDirection}, using the post as evidence.
4. Add proof points, comparisons, or risk notes that reduce decision uncertainty.
5. Close with a CTA aligned to the post intent: ${opportunity.recommendedAct}

## Sources

${sourceLinks}
`;
}
