import type { Connector, ConnectorInput, ExtractedRawItem } from "./types";

const redditSeed: Omit<ExtractedRawItem, "payload">[] = [
  {
    source: "reddit",
    externalId: "reddit-ai-tattoo-regret-001",
    sourceUrl: "https://www.reddit.com/r/tattoos/comments/mock_ai_tattoo_regret/",
    title: "I want an AI tattoo generator but I am scared the design will not age well",
    body: "People keep showing tiny line tattoos that look great on Pinterest, but I need a stencil-ready version and a way to check if it will blur in five years.",
    author: "ink-curious",
    tags: ["pain-point", "fine-line", "stencil"],
    metrics: { upvotes: 312, comments: 86 }
  },
  {
    source: "reddit",
    externalId: "reddit-coverup-002",
    sourceUrl: "https://www.reddit.com/r/tattooadvice/comments/mock_coverup/",
    title: "Can AI help me turn an old quote tattoo into a floral coverup?",
    body: "I do not know how to brief an artist. I want three coverup directions, not a random image generator result.",
    author: "coverup-planner",
    tags: ["coverup", "brief", "floral"],
    metrics: { upvotes: 198, comments: 42 }
  },
  {
    source: "reddit",
    externalId: "reddit-placement-003",
    sourceUrl: "https://www.reddit.com/r/tattoodesigns/comments/mock_placement/",
    title: "Best placement preview before committing to a minimal tattoo?",
    body: "I want to upload a body photo and compare wrist, collarbone, and ankle placements before booking.",
    author: "minimalist-ink",
    tags: ["placement", "minimal", "preview"],
    metrics: { upvotes: 421, comments: 104 }
  }
];

export const mockRedditConnector: Connector = {
  source: "reddit",
  mode: "mock",
  async extract(input: ConnectorInput) {
    return redditSeed.map((item) => ({
      ...item,
      payload: {
        ...item,
        matchedKeywords: input.keywords.filter((keyword) =>
          `${item.title} ${item.body}`.toLowerCase().includes(keyword.toLowerCase())
        ),
        productDirection: input.productDirection
      }
    }));
  }
};
