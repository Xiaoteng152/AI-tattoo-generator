import { etsyConnector } from "./etsy";
import { mockEtsyConnector } from "./mock-etsy";
import { mockRedditConnector } from "./mock-reddit";
import { redditConnector } from "./reddit";
import type { Connector } from "./types";

export function getConnectors(): Connector[] {
  const mode = process.env.CONNECTORS_MODE ?? "hybrid";

  if (mode === "mock") {
    return [mockRedditConnector, mockEtsyConnector];
  }

  if (mode === "real") {
    return [redditConnector, etsyConnector];
  }

  return [redditConnector, process.env.ETSY_API_KEY || process.env.ETSY_KEYSTRING ? etsyConnector : mockEtsyConnector];
}
