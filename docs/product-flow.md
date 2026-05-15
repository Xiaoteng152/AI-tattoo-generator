# Growth Automation Harness 产品链路图

当前产品围绕 `AI tattoo generator` 垂类，目标是把多源增长信号转成可执行的增长资产，并在后续通过反馈数据优化机会评分。

```mermaid
flowchart TD
  A[运营配置 Workflow Config<br/>产品方向 / 关键词 / 数据源 / Prompt / 输出模板] --> B[Workflow Run<br/>一次增长调研任务]

  B --> C[Extraction Layer<br/>数据提取]
  C --> C1[Reddit Connector<br/>用户痛点 / 真实讨论]
  C --> C2[Etsy Connector<br/>商业需求 / 商品信号]
  C --> C3[Pinterest / Trends<br/>后续视觉与搜索趋势]

  C1 --> D[Raw Items<br/>保存原始 payload / URL / metrics]
  C2 --> D
  C3 --> D

  D --> E[Normalization Layer<br/>清洗 / 去重 / 统一字段 / 互动分]
  E --> F[Normalized Items<br/>标题 / 正文 / 标签 / 来源 / engagementScore]

  F --> G[Enrichment Layer<br/>AI 或规则结构化分析]
  G --> G1[痛点 Pain Points]
  G --> G2[搜索意图 Intent]
  G --> G3[趋势类型 Trend Type]
  G --> G4[关键词与内容角度]
  G --> G5[证据摘要 Evidence Summary]

  G --> H[Scoring Layer<br/>机会评分]
  H --> I[Opportunities<br/>SEO 页面 / 内容选题 / 产品实验 / KOC/KOL 方向]

  I --> J[Output Generation<br/>增长资产生成]
  J --> J1[SEO Brief Markdown]
  J --> J2[短视频选题]
  J --> J3[图片 Prompt]
  J --> J4[KOC/KOL 触达话术]

  J --> K[Output Assets<br/>草稿 / 审核 / 导出]
  K --> L[运营执行<br/>发布 / 测试 / 外联]

  L --> M[Feedback Signals<br/>曝光 / 点击 / 收藏 / 评论 / 注册 / 收入]
  M --> H

  B --> N[Backtest<br/>不依赖数据库的连接与分析回测]
  N --> C
  N --> G
  N --> O[Backtest Report<br/>来源是否连通 / 分析数量 / Top Opportunity]
```

## 一句话链路

配置增长目标 -> 抓取多源信号 -> 保存原始数据 -> 清洗归一化 -> AI 分析 -> 机会评分 -> 生成增长资产 -> 运营执行 -> 反馈回流优化评分。

## 当前 MVP 已覆盖

- Workflow Config seed：固定 `AI tattoo generator` 产品方向和关键词。
- Connector：Reddit 真实搜索、Etsy API 接入点、mock fallback。
- Raw Item：保存来源、原始 payload、URL 和指标。
- Normalized Item：统一标题、正文、标签、来源和互动分。
- Enrichment：OpenAI-compatible AI 分析，缺少 API key 时回退到规则分析。
- Opportunity：基于证据和互动分生成机会评分。
- Output Asset：生成 Markdown SEO brief。
- Backtest：不依赖数据库，验证 Connector 和分析链路是否可用。

## 后续扩展方向

- 接入 Pinterest 或 Google Trends 做视觉/搜索趋势验证。
- 新增 DeepSearch Plan，把搜索问题、来源计划和证据包显式记录下来。
- 支持 Output Asset 审核、编辑、导出 Markdown/CSV。
- 记录执行后的 Feedback Signals，把真实效果回流到 Opportunity Score。
