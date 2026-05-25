# DeepSearch 设计文档

## 定位

DeepSearch 是 Growth Automation Harness 的主动研究层。普通 workflow 负责周期性扫描和执行，DeepSearch 负责用户主动提出复杂增长问题后，自动分类垂类、拆解研究任务、调度子 Agent、提取证据、压缩上下文，并生成带来源证据的增长机会报告。

第一版不要做泛搜索产品，而是做 **Vertical DeepSearch for Growth**。

DeepSearch 的内容生产分支是 [KOL 内容增长 Agent](./KOL_CONTENT_AGENT.md)。它使用 LangGraph 编排长流程、checkpoint、interrupt 和 resume，把 DeepSearch 证据链转成爆款方向候选、素材卡、观点卡、中文长推或文章草稿。Search 能力按 MVP / V1 / V2 / V3 演进：先跑通手动输入和现有 Connector，再逐步接产品案例搜索、社交信号搜索和持续选题雷达。

```txt
用户问题
  -> 垂类识别
  -> 研究计划
  -> Source Subagents
  -> Evidence Extractor
  -> Context Manager
  -> Synthesis Agent
  -> Opportunity Cards
  -> Output Assets / Workflow Tasks
```

对于当前项目，第一个垂类固定为 **AI tattoo generator**，但系统设计要允许后续扩展到 AI SaaS、跨境电商、内容 SEO 和 KOC/KOL 发现。

## 核心使用场景

示例问题：

```txt
帮我研究 AI tattoo generator 最近在 Reddit 和 Pinterest 上有什么增长机会？
```

系统需要完成：

1. 判断这是 `ai_tattoo_generator` 垂类。
2. 拆成用户痛点、视觉趋势、SEO 内容机会、商品或素材需求四类研究任务。
3. 分配 Reddit、Pinterest/Etsy、SEO、YouTube/TikTok 子 Agent。
4. 每个子 Agent 返回结构化 finding 和 evidence。
5. 统一合成增长报告。
6. 把高价值机会转换成 SEO brief、短视频选题、素材 Prompt 或 KOC/KOL 触达任务。

## 垂类分类

| 垂类 | 典型问题 | 优先数据源 | 输出重点 |
| --- | --- | --- | --- |
| `ai_tattoo_generator` | AI 纹身生成器怎么增长 | Reddit、Pinterest、Etsy、YouTube、SEO | 风格趋势、用户痛点、素材 Prompt、SEO brief |
| `ai_saas` | AI 工具或自动化产品增长机会 | Reddit、YouTube、SEO | 痛点、替代品比较、商业意图关键词 |
| `cross_border_ecommerce` | 跨境商品和视觉趋势 | Etsy、Pinterest、TikTok、YouTube | 商品趋势、视觉风格、Listing 角度 |
| `content_seo` | 内容和 SEO 选题机会 | Google/SERP、Reddit、YouTube | 关键词簇、搜索意图、页面 brief |
| `community_kol` | 社群/KOL/KOC 机会 | Reddit、YouTube、TikTok、X | 创作者、社群话题、触达话术 |

垂类配置：

```ts
type VerticalConfig = {
  id: string;
  name: string;
  defaultSources: SourceType[];
  seedKeywords: string[];
  searchQuestions: string[];
  scoringRules: ScoringRule[];
  reportTemplate: string;
};
```

## Agent 角色

### Query Understanding Agent

职责：

- 理解用户真实意图。
- 判断目标垂类、市场、时间范围和期望输出。
- 提取种子关键词。
- 决定需要哪些数据源。

输出示例：

```json
{
  "intent": "find_growth_opportunities",
  "vertical": "ai_tattoo_generator",
  "targetMarket": "US",
  "timeRange": "last_30_days",
  "keywords": ["ai tattoo", "tattoo generator", "fine line tattoo"],
  "requiredSources": ["reddit", "pinterest", "etsy", "seo"]
}
```

### Vertical Router

职责：

- 基于用户 query 和手动选择确定垂类。
- 选择搜索策略。
- 选择子 Agent 组合。

路由规则：

```txt
AI tattoo generator -> Reddit Agent + Pinterest/Etsy Agent + SEO Agent
AI SaaS -> Reddit Agent + YouTube Agent + SEO Agent
Cross-border ecommerce -> Etsy Agent + Pinterest Agent + TikTok Agent
Content SEO -> SEO Agent + Reddit Agent + YouTube Agent
Community / KOL -> Reddit Agent + YouTube Agent + TikTok/X Agent
```

### Research Planner

职责：

- 把用户问题拆成多个可以独立执行的研究任务。
- 每个任务指定 agent、source、关键词和期望证据类型。

AI tattoo generator 示例计划：

```json
[
  {
    "id": "rq1",
    "question": "Users mention what pain points when looking for tattoo ideas or AI tattoo tools?",
    "agent": "reddit_agent",
    "sourceTypes": ["reddit"]
  },
  {
    "id": "rq2",
    "question": "Which tattoo visual styles are gaining attention?",
    "agent": "visual_trend_agent",
    "sourceTypes": ["pinterest", "etsy"]
  },
  {
    "id": "rq3",
    "question": "Which SEO topics around AI tattoo generator have clear search intent?",
    "agent": "seo_agent",
    "sourceTypes": ["seo"]
  },
  {
    "id": "rq4",
    "question": "What content angles could convert this trend into short videos or landing pages?",
    "agent": "content_agent",
    "sourceTypes": ["youtube", "tiktok"]
  }
]
```

### Source Subagents

Reddit Agent：

- 搜索 subreddit、帖子和评论。
- 提取痛点、需求、疑问、抱怨和真实表达。
- 输出带 URL、互动指标和置信度的 evidence。

Pinterest / Etsy Agent：

- 发现视觉风格、商品趋势、关键词和收藏/销量信号。
- 适合 AI tattoo generator 的风格趋势判断。

SEO Agent：

- 扩展关键词。
- 判断搜索意图。
- 生成 SEO 页面机会和页面 brief。

YouTube / TikTok Agent：

- 发现内容角度、热门标题模式、评论需求。
- 生成短视频选题和脚本方向。

KOC/KOL Agent：

- 提取创作者候选人。
- 评估相关性、互动质量和触达理由。
- 生成个性化触达草稿。

### Evidence Extractor

职责：

- 不直接生成结论，只提取证据。
- 每条证据必须保留 source URL。
- 记录 metrics、snippet、confidence 和支持的 claim。

输出示例：

```json
{
  "claim": "Users want fine line tattoo ideas that can be personalized before visiting a tattoo artist.",
  "evidence": [
    {
      "source": "reddit",
      "title": "Looking for fine line tattoo ideas before my appointment",
      "url": "https://example.com/post",
      "metric": "86 upvotes, 31 comments",
      "snippet": "User asks for ways to preview custom tattoo ideas.",
      "confidence": 0.78
    }
  ]
}
```

### Synthesis Agent

职责：

- 汇总各子 Agent 的 finding。
- 合并重复证据。
- 输出增长报告、机会卡和执行动作。
- 标注不确定性和缺失信息。

## 上下文窗口设计

DeepSearch 不能把所有原始数据直接塞进最终 Prompt。上下文按四层管理：

```txt
L1 Raw Context
原始帖子、评论、视频描述、商品列表、Pin、SERP snippet。

L2 Extracted Evidence
结构化证据：claim、snippet、URL、metrics、confidence。

L3 Working Memory
当前 DeepSearch run 的问题、垂类、研究计划、finding、gap。

L4 Long-term Memory
历史报告、已采纳机会、Prompt 版本、垂类规则、用户偏好。
```

上下文预算：

```ts
type ContextBudget = {
  maxRawItemsPerAgent: number;
  maxEvidencePerAgent: number;
  maxPlannerTokens: number;
  maxSynthesisTokens: number;
  maxFinalReportTokens: number;
};
```

MVP 默认值：

```json
{
  "maxRawItemsPerAgent": 20,
  "maxEvidencePerAgent": 10,
  "maxPlannerTokens": 2000,
  "maxSynthesisTokens": 12000,
  "maxFinalReportTokens": 8000
}
```

压缩规则：

1. Raw data 不直接进入最终报告 Prompt。
2. 每个子 Agent 先把原始结果压缩成 findings 和 evidence。
3. 相似 evidence 合并。
4. 低置信度 evidence 标记或丢弃。
5. 最终 synthesis 只读取 top evidence、finding 和 gap。
6. 原始数据仍保留在数据库里，可供用户回看。

## 数据结构

```ts
type DeepSearchRun = {
  id: string;
  query: string;
  vertical: string;
  status: "planning" | "searching" | "analyzing" | "reporting" | "completed" | "failed";
  depth: "quick" | "standard" | "deep";
  plan: ResearchTask[];
  contextBudget: ContextBudget;
  createdAt: Date;
  completedAt?: Date;
};

type ResearchTask = {
  id: string;
  runId: string;
  question: string;
  assignedAgent: string;
  sourceTypes: string[];
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
};

type AgentFinding = {
  id: string;
  runId: string;
  taskId: string;
  agent: string;
  summary: string;
  evidence: Evidence[];
  gaps: string[];
  confidence: number;
};

type Evidence = {
  id: string;
  runId: string;
  sourceType: string;
  title: string;
  url: string;
  snippet: string;
  metrics: Record<string, unknown>;
  publishedAt?: string;
  confidence: number;
};

type DeepSearchReport = {
  id: string;
  runId: string;
  executiveSummary: string;
  keyFindings: string[];
  opportunities: ReportOpportunity[];
  risks: string[];
  recommendedActions: ReportAction[];
  citations: Evidence[];
};
```

## 报告结构

```txt
1. Executive Summary
2. What is trending
3. User pain points
4. Evidence table
5. Growth opportunities
6. Recommended actions
7. Risks and uncertainty
8. Next search suggestions
```

机会卡结构：

```json
{
  "title": "Fine line AI tattoo preview workflow",
  "whyNow": "Recent discussions show users want personalized tattoo ideas before appointments.",
  "audience": "People planning first tattoos and fine line tattoo fans",
  "evidenceCount": 6,
  "confidence": 0.82,
  "growthActions": [
    "Create SEO page: AI fine line tattoo generator",
    "Publish short video: 3 ways to preview your tattoo before visiting an artist",
    "Generate Pinterest board prompts for minimal tattoo ideas"
  ],
  "priority": "high"
}
```

## MVP 开发顺序

1. 先跑通普通扫描闭环：Reddit -> Raw Item -> Normalized Item -> Enrichment -> Opportunity -> Output Asset。
2. 加 DeepSearch v1：query -> vertical router -> planner -> Reddit Agent + SEO Agent -> report。
3. 加视觉/电商子 Agent：Pinterest 或 Etsy。
4. 加上下文预算和 evidence board。
5. 加 agent timeline 和报告转任务。

最小可演示版本：

```txt
输入：
"Find growth opportunities for AI tattoo generator around fine line tattoo ideas"

系统：
1. 自动识别 ai_tattoo_generator 垂类
2. 拆成 Reddit pain points / visual trend / SEO topics
3. 子 Agent 并发搜索或读取 fixture
4. 汇总 evidence
5. 生成 3 个 opportunity cards
6. 一键转成 SEO brief / short video idea / prompt asset
```
