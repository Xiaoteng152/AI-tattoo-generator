import { ProxyAgent, fetch as undiciFetch } from "undici";

function getProxyUrl(): string | undefined {
  return (
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    process.env.https_proxy?.trim() ||
    process.env.http_proxy?.trim() ||
    undefined
  );
}

let proxyDispatcher: ProxyAgent | undefined;

function getProxyDispatcher(): ProxyAgent | undefined {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    return undefined;
  }

  proxyDispatcher ??= new ProxyAgent(proxyUrl);
  return proxyDispatcher;
}

export function createAuthFetch(): typeof fetch {
  const dispatcher = getProxyDispatcher();
  if (!dispatcher) {
    return fetch;
  }

  return ((input: RequestInfo | URL, init?: RequestInit) =>
    // undici fetch accepts a ProxyAgent dispatcher; RequestInit types differ slightly.
    undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...(init as Parameters<typeof undiciFetch>[1]),
      dispatcher
    }) as unknown as Promise<Response>) as typeof fetch;
}
