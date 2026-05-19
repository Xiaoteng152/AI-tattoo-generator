/**
 * Vertical Router：在 Query Understanding 之后选定垂类配置与子 Agent 组合。
 * 按用户提及或默认的数据源过滤 searchQuestions，避免调度无数据源的 Agent。
 */
import { getVerticalConfig } from "./config/verticals";
import type {
  AgentName,
  DeepSearchSource,
  QueryUnderstanding,
  SearchQuestionTemplate,
  VerticalConfig,
  VerticalId
} from "./types";

export type RouteResult = {
  vertical: VerticalConfig;
  agents: AgentName[];
  sources: DeepSearchSource[];
  questions: SearchQuestionTemplate[];
  rationale: string;
};

export type RouteInput = {
  understanding: QueryUnderstanding;
  manualVertical?: VerticalId;
  manualSources?: DeepSearchSource[];
};

/** 返回本 run 应执行的 Agent 列表、数据源与研究问题模板 */
export function routeVertical(input: RouteInput): RouteResult {
  const verticalId = input.manualVertical ?? input.understanding.vertical;
  const vertical = getVerticalConfig(verticalId);

  const sources = input.manualSources?.length
    ? Array.from(
        new Set<DeepSearchSource>([
          ...input.manualSources,
          ...vertical.defaultSources
        ])
      )
    : Array.from(
        new Set<DeepSearchSource>([
          ...input.understanding.requiredSources,
          ...vertical.defaultSources
        ])
      );

  const questions = vertical.searchQuestions.filter((question) =>
    question.sourceTypes.some((source) => sources.includes(source))
  );

  const agents = Array.from(
    new Set<AgentName>(questions.map((question) => question.agent))
  );

  return {
    vertical,
    agents,
    sources,
    questions: questions.length ? questions : vertical.searchQuestions,
    rationale: input.manualVertical
      ? `Routed to ${vertical.name} via manual override`
      : `Routed to ${vertical.name} based on query understanding`
  };
}
