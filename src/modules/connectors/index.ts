import { etsyConnector } from "./etsy";
import { mockEtsyConnector } from "./mock-etsy";
import { mockRedditConnector } from "./mock-reddit";
import { redditConnector } from "./reddit";
import { twitterConnector } from "./twitter";
import type { Connector, SourceName } from "./types";

type ConnectorOptions = {
  allowMockFallback?: boolean;
  sources?: SourceName[];
};

export function getConnectors(options: ConnectorOptions = {}): Connector[] {
  const mode = process.env.CONNECTORS_MODE ?? "hybrid";
  const pickSources = (connectors: Connector[]) =>
    options.sources?.length ? connectors.filter((connector) => options.sources?.includes(connector.source)) : connectors;
  const usesOfficialXApi = process.env.TWITTER_SOURCE === "x-api" || process.env.TWITTER_SOURCE === "official";
  const shouldIncludeTwitter = !usesOfficialXApi || Boolean(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || options.sources?.includes("twitter"));

  if (mode === "mock") {
    return pickSources([mockRedditConnector, mockEtsyConnector]);
  }

  if (mode === "real") {
    return pickSources([redditConnector, etsyConnector, twitterConnector]);
  }

  const twitterConnectors = shouldIncludeTwitter ? [twitterConnector] : [];

  if (process.env.ETSY_API_KEY || process.env.ETSY_KEYSTRING) {
    return pickSources([redditConnector, etsyConnector, ...twitterConnectors]);
  }

  return pickSources(options.allowMockFallback ? [redditConnector, mockEtsyConnector, ...twitterConnectors] : [redditConnector, ...twitterConnectors]);
}
