# DeepSearch Agent Design

## 目标

DeepSearch Agent 是 AI tattoo generator 作品集 demo 的核心能力。它要把一个增长目标转成可追溯的研究计划、多源证据、机会判断和增长资产建议。

它不是“调用搜索模型拿答案”，而是自己实现一个受控 Agent pipeline：

1. Plan：生成研究问题和搜索计划。
2. Route：决定每个问题使用哪些工具和数据源。
3. Search：调用 Reddit、Etsy、Pinterest/Trends 等 connector。
4. Observe：保存 Raw Item 和 Normalized Item。
5. Compress：把大量搜索结果压缩成 Evidence Bundle。
6. Synthesize：生成 Opportunity 和 DeepSearch Report。
7. Act：生成 SEO brief、短视频选题、Pinterest Prompt、KOC/KOL outreach。

## 非目标

- 不做泛化搜索引擎。
- 不让 LLM 无约束浏览互联网。
- 不生成无来源证据的结论。
- 不在第一版做全自动发布。
- 不在第一版实现复杂多 Agent 并行。

## Agent Loop

第一版 DeepSearch loop：

```text
User Goal
  -> DeepSearch Planner
  -> DeepSearch Plan
  -> Question Queue
  -> Source Router
  -> Connector Calls
  -> Raw Items
  -> Normalized Items
  -> Evidence Selector
  -> Evidence Bundle
  -> Opportunity Synthesizer
  -> DeepSearch Report
  -> Output Asset Generator
```

## Tools

第一版 tools 先复用现有 connector，不急着引入复杂 agent framework。

| Tool | 输入 | 输出 | 用途 |
| --- | --- | --- | --- |
| RedditSearchTool | query, limit, lookbackDays | Raw Items | 用户痛点、真实讨论、pre-booking concern |
| EtsySearchTool | query, limit | Raw Items | 商业需求、商品化设计、购买信号 |
| PinterestSearchTool | query, limit | Raw Items | 视觉趋势、风格、保存信号，V3 实现 |
| TrendsTool | query list | trend metrics | 搜索需求验证，V3 实现 |
| EnrichmentTool | Normalized Item | Enrichment | 痛点、意图、趋势、内容角度 |
| EvidenceCompressor | Normalized Items + Enrichments | Evidence Bundle | s06 上下文压缩 |
| ReportWriter | Evidence Bundle | DeepSearch Report | 最终研究报告 |

## Run State

DeepSearch 必须持久化中间状态，方便展示过程、失败恢复和作品集讲解。

```ts
type DeepSearchRunState = {
  runId: string
  status: "pending" | "running" | "completed" | "failed"
  goal: string
  planId?: string
  currentStep: string
  questionsCompleted: number
  questionsTotal: number
  rawItemCount: number
  evidenceBundleCount: number
  opportunityCount: number
  error?: string
}
```

## DeepSearch Plan

```ts
type DeepSearchPlan = {
  goal: string
  audience: string
  seedKeywords: string[]
  questions: DeepSearchQuestion[]
  expectedOutputs: ("seo_brief" | "short_video" | "pinterest_prompt" | "kol_outreach")[]
}

type DeepSearchQuestion = {
  id: string
  question: string
  intent: "pain_point" | "commercial" | "visual_trend" | "seo" | "content" | "creator_outreach"
  sources: ("reddit" | "etsy" | "pinterest" | "google_trends")[]
  queries: string[]
}
```

默认 AI tattoo generator 问题：

1. 用户为什么想用 AI tattoo generator？
2. 用户在纹身设计前最担心什么？
3. 哪些 tattoo 风格正在反复出现？
4. 哪些关键词有 SEO 页面机会？
5. 哪些短视频内容角度可能传播？
6. 哪些纹身师、设计师或内容创作者适合 KOC/KOL 触达？

## Evidence Bundle

Evidence Bundle 是 s06 上下文压缩的核心。它负责把大量搜索结果压成可以被后续模型消费的证据包。

```ts
type EvidenceBundle = {
  id: string
  questionId: string
  opportunityCandidate: string
  sources: {
    source: "reddit" | "etsy" | "pinterest" | "google_trends"
    keyFindings: string[]
    representativeEvidence: {
      rawItemId?: string
      normalizedItemId?: string
      title: string
      url: string
      metricSummary: string
      whyItMatters: string
    }[]
  }[]
  compressedSummary: string
  confidence: number
}
```

压缩规则：

1. 每个来源只保留 3-5 条代表证据。
2. 每条证据必须保留 URL。
3. `whyItMatters` 必须说明它证明了什么。
4. 不允许无证据结论进入 Opportunity。
5. 压缩后的 summary 必须能支持 SEO brief、短视频选题和 outreach。

## Opportunity Synthesis

第一版 Opportunity 聚合逻辑：

```text
Opportunity Score =
  用户痛点强度 * 0.30 +
  商业需求信号 * 0.25 +
  视觉/内容传播信号 * 0.20 +
  搜索需求信号 * 0.15 +
  来源覆盖度 * 0.10
```

第一版可以先用规则评分，后续再让 LLM 参与解释和校准。

## DeepSearch Report

```ts
type DeepSearchReport = {
  runId: string
  title: string
  summary: string
  topOpportunities: {
    title: string
    score: number
    confidence: number
    evidenceBundleIds: string[]
    recommendedActions: string[]
  }[]
  risks: string[]
  nextSearchSuggestions: string[]
}
```

报告必须包含：

- 研究目标。
- 搜索问题。
- 数据源覆盖。
- Top Opportunities。
- 每个机会的证据来源。
- 推荐增长动作。
- 下一轮搜索建议。

## Failure Handling

| 失败场景 | 处理方式 |
| --- | --- |
| 某个 connector 失败 | 记录 step error，其他来源继续执行 |
| LLM 输出非 JSON | 使用 schema fallback 或 rules fallback |
| 某个问题没有证据 | 标记为 low confidence，不生成 Opportunity |
| 所有来源都失败 | DeepSearch Run 标记 failed |
| 数据过多 | 先按 engagement/source relevance 截断，再压缩 |

## UI 规划

新增 `/deepsearch` 页面：

1. 顶部：目标、关键词、运行按钮。
2. 左侧：DeepSearch Plan 和问题列表。
3. 中间：source progress 和 connector 状态。
4. 右侧：Evidence Bundle 摘要。
5. 底部：DeepSearch Report 和 Top Opportunities。

## 实现顺序

### Step 1：P0 清理

- 修正 backtest 默认值。
- 移除 crypto/twitter 示例。
- 首页文案统一为 tattoo 场景。

### Step 2：数据模型

新增 Prisma models：

- `DeepSearchRun`
- `DeepSearchPlan`
- `DeepSearchQuestion`
- `EvidenceBundle`
- `DeepSearchReport`

### Step 3：Planner

- 先用规则生成默认 plan。
- 再接 LLM Planner。
- Planner 输出必须过 Zod schema 校验。

### Step 4：Runner

- 根据 plan 逐问题执行 connector。
- 保存 question-level step metadata。
- 复用 Raw Item / Normalized Item / Enrichment。

### Step 5：Compressor

- 按 question 和 source 聚合证据。
- 生成 Evidence Bundle。
- 保留 representative evidence 和 URL。

### Step 6：Report

- 由 Evidence Bundle 生成 DeepSearch Report。
- 生成 Top Opportunities。
- 接入页面展示。

## 作品集讲法

> 这个 DeepSearch 不是简单调用搜索 API。它是一个我自己实现的受控 Agent pipeline：LLM 负责规划和总结，但搜索工具、状态持久化、证据压缩、跨源聚合和输出资产生成都在系统里显式建模。因此它可以展示真实 Agent 产品的工程能力，而不是只展示 Prompt 能力。
