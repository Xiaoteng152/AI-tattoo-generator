import type { Connector, ConnectorInput, ExtractedRawItem } from "./types";

type EtsyListing = {
  listing_id?: number;
  title?: string;
  description?: string;
  url?: string;
  user_id?: number;
  shop_id?: number;
  num_favorers?: number;
  views?: number;
  tags?: string[];
  taxonomy_path?: string[];
  price?: {
    amount?: number;
    divisor?: number;
    currency_code?: string;
  };
  created_timestamp?: number;
  updated_timestamp?: number;
};

type EtsyListingsResponse = {
  results?: EtsyListing[];
};

const etsyBaseUrl = "https://api.etsy.com/v3/application";

function getEtsyApiKey() {
  return process.env.ETSY_API_KEY ?? process.env.ETSY_KEYSTRING;
}

function summarizeDescription(description?: string) {
  if (!description) {
    return "";
  }

  return description.replace(/\s+/g, " ").trim().slice(0, 900);
}

function priceToSignal(price?: EtsyListing["price"]) {
  if (!price?.amount || !price.divisor) {
    return 0;
  }

  return Math.round(price.amount / price.divisor);
}

export const etsyConnector: Connector = {
  source: "etsy",
  mode: "real",
  async extract(input: ConnectorInput): Promise<ExtractedRawItem[]> {
    const apiKey = getEtsyApiKey();

    if (!apiKey) {
      throw new Error("ETSY_API_KEY is required for the real Etsy connector");
    }

    const limit = input.limitPerSource ?? 8;
    const query = input.keywords.slice(0, 3).join(" ");
    const url = new URL("/listings/active", etsyBaseUrl);
    url.searchParams.set("keywords", query || input.productDirection);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey
      },
      next: {
        revalidate: 600
      }
    });

    if (!response.ok) {
      throw new Error(`Etsy API failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as EtsyListingsResponse;
    const listings = payload.results ?? [];

    return listings
      .filter((listing) => listing.listing_id && listing.title)
      .map((listing): ExtractedRawItem => {
        const tags = Array.from(
          new Set(["real-etsy", "commercial-signal", ...(listing.tags ?? []), ...(listing.taxonomy_path ?? [])])
        ).slice(0, 12);

        return {
          source: "etsy",
          externalId: `etsy-${listing.listing_id}`,
          sourceUrl: listing.url ?? `https://www.etsy.com/listing/${listing.listing_id}`,
          title: listing.title ?? "Untitled Etsy listing",
          body: summarizeDescription(listing.description),
          author: listing.shop_id ? `shop:${listing.shop_id}` : listing.user_id ? `user:${listing.user_id}` : undefined,
          publishedAt: listing.created_timestamp
            ? new Date(listing.created_timestamp * 1000).toISOString()
            : listing.updated_timestamp
              ? new Date(listing.updated_timestamp * 1000).toISOString()
              : undefined,
          tags,
          metrics: {
            favorites: listing.num_favorers ?? 0,
            salesSignal: priceToSignal(listing.price),
            saves: listing.views ?? 0
          },
          payload: {
            ...listing,
            matchedKeywords: input.keywords,
            productDirection: input.productDirection
          }
        };
      });
  }
};
