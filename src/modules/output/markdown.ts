type MarkdownOpportunity = {
  title: string;
  type: string;
  score: number;
  confidence: number;
  evidenceSummary: string;
  sourceUrls: string[];
  recommendedAct: string;
};

export function generateSeoBriefMarkdown(opportunity: MarkdownOpportunity) {
  const sourceLinks = opportunity.sourceUrls.map((url) => `- ${url}`).join("\n");

  return `# ${opportunity.title}

## Opportunity

- Type: ${opportunity.type}
- Score: ${opportunity.score}
- Confidence: ${opportunity.confidence}

## Evidence

${opportunity.evidenceSummary}

Sources:
${sourceLinks}

## SEO Brief

Target search intent: people who want an AI tattoo generator but need confidence before talking to an artist.

Recommended page structure:

1. Start with the specific concern from the evidence.
2. Show three design directions with practical constraints.
3. Explain what makes a concept stencil-ready.
4. Add a checklist for placement, aging, and artist handoff.
5. Close with a CTA to generate a design brief.

## Content Angle

${opportunity.recommendedAct}
`;
}
