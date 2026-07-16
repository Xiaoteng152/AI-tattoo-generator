import { normalizeTradingDigest, type TradingDigest, type TradingDigestPost } from "./trading-digest";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type AnalyzeTradingPostsInput = {
  posts: TradingDigestPost[];
  strategy: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetcher?: Fetcher;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export const TRADING_PROMPT_VERSION = "trading-radar-v1";

export class TradingAiNotConfiguredError extends Error {
  constructor() {
    super("AI 未配置：请设置 OPENAI_API_KEY");
    this.name = "TradingAiNotConfiguredError";
  }
}

function extractJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? content;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end < start) {
    throw new Error("Trading AI response did not contain JSON");
  }

  return JSON.parse(raw.slice(start, end + 1)) as {
    summary?: unknown;
    signals?: unknown;
  };
}

export async function analyzeTradingPosts(input: AnalyzeTradingPostsInput): Promise<TradingDigest> {
  const apiKey = input.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new TradingAiNotConfiguredError();
  }

  if (!input.posts.length) {
    return { summary: [], signals: [] };
  }

  const baseUrl = (input.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = input.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "你是交易推文证据整理器，不是投资顾问。只根据输入推文提取原作者明确表达的内容。",
            "返回 JSON：summary 数组；signals 数组。summary 最多 3 条，每条不超过 40 个中文字。signals 最多 3 条。",
            "每个 signal 必须包含 asset, direction, entryPrice, entryPriceEvidence, entryTiming, entryTimingEvidence, invalidation, invalidationEvidence, strategyMatch, strategyReason, sourcePostIds。",
            "direction 只能是 LONG、SHORT、WATCH、NONE；strategyMatch 只能是 MATCH、CONFLICT、UNKNOWN。",
            "entryPriceEvidence、entryTimingEvidence、invalidationEvidence 必须逐字复制输入推文中的短证据。原文没说时，对应值写未明确、Evidence 写空字符串。",
            "禁止自行给出现在入场、价格、止损、仓位、胜率或收益预测。没有明确交易信号时返回空 signals。"
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            strategy: input.strategy || "未配置个人交易规则",
            posts: input.posts.map((post) => ({
              id: post.id,
              text: post.text,
              sourceUrl: post.sourceUrl
            }))
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Trading AI failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Trading AI returned empty content");
  }

  return normalizeTradingDigest(extractJson(content), input.posts);
}
