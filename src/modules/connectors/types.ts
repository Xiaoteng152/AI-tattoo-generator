export type SourceName = "reddit" | "etsy";

export type ConnectorInput = {
  keywords: string[];
  productDirection: string;
  limitPerSource?: number;
  lookbackDays?: number;
};

export type ExtractedRawItem = {
  source: SourceName;
  externalId: string;
  sourceUrl: string;
  title: string;
  body: string;
  author?: string;
  publishedAt?: string;
  tags: string[];
  metrics: {
    upvotes?: number;
    comments?: number;
    favorites?: number;
    salesSignal?: number;
    saves?: number;
  };
  payload: Record<string, unknown>;
};

export interface Connector {
  source: SourceName;
  mode: "mock" | "real";
  extract(input: ConnectorInput): Promise<ExtractedRawItem[]>;
}
