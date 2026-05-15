import { etsyConnector } from "./etsy";
import { mockEtsyConnector } from "./mock-etsy";
import { mockRedditConnector } from "./mock-reddit";
import { redditConnector } from "./reddit";
import type { Connector } from "./types";

type ConnectorOptions = {
  allowMockFallback?: boolean;
};

export function getConnectors(options: ConnectorOptions = {}): Connector[] {
  const mode = process.env.CONNECTORS_MODE ?? "hybrid";

  if (mode === "mock") {
    return [mockRedditConnector, mockEtsyConnector];
  }

  if (mode === "real") {
    return [redditConnector, etsyConnector];
  }

  if (process.env.ETSY_API_KEY || process.env.ETSY_KEYSTRING) {
    return [redditConnector, etsyConnector];
  }

  return options.allowMockFallback ? [redditConnector, mockEtsyConnector] : [redditConnector];
}
