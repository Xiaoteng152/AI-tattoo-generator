/**
 * Connector 桥接层：把 Growth Harness 已有 Connector 接入 DeepSearch 流水线。
 * 输出 DeepSearchObservation（含 normalize/enrich），供各 Source Subagent 转 evidence。
 */
import { getConnectors } from "@/modules/connectors";
import type { Connector, ExtractedRawItem, SourceName } from "@/modules/connectors/types";
import { enrichItem } from "@/modules/enrichment/enricher";
import { normalizeRawItem } from "@/modules/normalization/normalize";
import type {
  AgentName,
  DeepSearchObservation,
  DeepSearchQuestion,
  DeepSearchSource,
  DeepSearchSourceProgress
} from "../types";

// 已接入 Connector 模块的数据源；其余（Pinterest/SEO 等）暂用 fixture
const connectorSources: SourceName[] = ["reddit", "etsy", "twitter"];

export function isConnectorSource(source: DeepSearchSource): source is SourceName {
  return connectorSources.includes(source as SourceName);
}

function getConnector(source: SourceName): Connector | undefined {
  return getConnectors({ allowMockFallback: true, sources: [source] })[0];
}

export type ConnectorRunInput = {
  question: DeepSearchQuestion;
  source: SourceName;
  agent: AgentName;
  productDirection: string;
  limitPerSource: number;
  lookbackDays: number;
};

export type ConnectorRunResult = {
  observations: DeepSearchObservation[];
  progress: DeepSearchSourceProgress;
};

async function transformItem(
  rawItem: ExtractedRawItem,
  question: DeepSearchQuestion,
  agent: AgentName,
  query: string
): Promise<DeepSearchObservation> {
  const normalized = normalizeRawItem(rawItem);

  let enrichment: DeepSearchObservation["enrichment"];

  try {
    enrichment = await enrichItem(normalized);
  } catch {
    enrichment = undefined;
  }

  return {
    questionId: question.id,
    agent,
    query,
    source: rawItem.source as DeepSearchSource,
    rawItem: {
      externalId: rawItem.externalId,
      sourceUrl: rawItem.sourceUrl,
      title: rawItem.title,
      author: rawItem.author,
      snippet: rawItem.body.slice(0, 240),
      publishedAt: rawItem.publishedAt,
      metrics: rawItem.metrics
    },
    normalized,
    enrichment
  };
}

/** 对单个研究问题、单个 Connector 数据源执行 extract → normalize → enrich */
export async function runConnectorForQuestion(
  input: ConnectorRunInput
): Promise<ConnectorRunResult> {
  const startedAt = Date.now();
  const connector = getConnector(input.source);
  const fallbackQuery = input.question.queries[0] ?? input.question.question;

  if (!connector) {
    return {
      observations: [],
      progress: {
        questionId: input.question.id,
        agent: input.agent,
        query: fallbackQuery,
        source: input.source,
        ok: false,
        itemCount: 0,
        durationMs: Date.now() - startedAt,
        error: `${input.source} connector is not available in the current mode`
      }
    };
  }

  try {
    const rawItems = await connector.extract({
      productDirection: input.productDirection,
      keywords: input.question.queries.length
        ? input.question.queries
        : [fallbackQuery],
      limitPerSource: input.limitPerSource,
      lookbackDays: input.lookbackDays
    });

    const observations = await Promise.all(
      rawItems.map((rawItem) => transformItem(rawItem, input.question, input.agent, fallbackQuery))
    );

    return {
      observations,
      progress: {
        questionId: input.question.id,
        agent: input.agent,
        query: fallbackQuery,
        source: input.source,
        ok: true,
        itemCount: observations.length,
        durationMs: Date.now() - startedAt
      }
    };
  } catch (error) {
    return {
      observations: [],
      progress: {
        questionId: input.question.id,
        agent: input.agent,
        query: fallbackQuery,
        source: input.source,
        ok: false,
        itemCount: 0,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown connector error"
      }
    };
  }
}
