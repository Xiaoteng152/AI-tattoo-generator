import type { Connector, ConnectorInput, ExtractedRawItem } from "./types";

const etsySeed: Omit<ExtractedRawItem, "payload">[] = [
  {
    source: "etsy",
    externalId: "etsy-fine-line-pack-001",
    sourceUrl: "https://www.etsy.com/listing/mock-fine-line-tattoo-design-pack",
    title: "Custom fine line tattoo design pack with editable stencil",
    body: "Seller offers minimal symbols, birth flowers, and placement mockups as a downloadable consultation bundle.",
    author: "LineworkStudio",
    tags: ["commercial-signal", "fine-line", "stencil"],
    metrics: { favorites: 1240, salesSignal: 410 }
  },
  {
    source: "etsy",
    externalId: "etsy-coverup-brief-002",
    sourceUrl: "https://www.etsy.com/listing/mock-coverup-design-brief",
    title: "Personalized coverup tattoo concept board",
    body: "A high-priced listing focused on artist-ready concepts, mood boards, and revision notes for coverup projects.",
    author: "InkBriefCo",
    tags: ["commercial-signal", "coverup", "artist-brief"],
    metrics: { favorites: 820, salesSignal: 255 }
  }
];

export const mockEtsyConnector: Connector = {
  source: "etsy",
  mode: "mock",
  async extract(input: ConnectorInput) {
    return etsySeed.map((item) => ({
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
