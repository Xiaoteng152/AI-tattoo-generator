# Growth Automation Harness 上下文

## 领域概述

Automnic TT 被规划为一个面向海外 C 端产品的 Growth Automation Harness。它的目标是把分散的市场信号，转化为运营可配置、可重复执行的增长工作流。

第一个作品集演示垂类固定为 **AI tattoo generator**。平台要围绕这个垂类展示完整能力：从 Reddit 挖掘用户痛点，从 Etsy 验证商业需求，从 Pinterest 验证视觉趋势，从 TikTok/YouTube 观察内容传播，再生成 SEO brief、短视频选题、图片 Prompt 和 KOC/KOL 触达建议。

这个方向来自增长工程师岗位 JD：主动挖掘增长机会、搭建端到端自动化工作流、支持批量内容生产、支持 KOC/KOL 发现和追踪、自动化社媒分发运营，并完成增长数据的清洗和分析。

## 角色

- **增长运营**：配置关键词、过滤条件、模板、审核规则和执行节奏。
- **增长工程师**：构建 Connector、工作流模块、数据管道、AI 增强和自动化能力。
- **内容运营**：审核生成的 SEO brief、社媒文案、短视频脚本、素材 Prompt 和发布计划。
- **商务/达人运营**：审核 KOC/KOL 候选人、触达话术和跟进状态。
- **创始人或增长负责人**：评估机会分数、趋势证据、活动效果和资源投入优先级。

## 核心术语

- **Growth Automation Harness**：整个平台。它连接数据提取、数据清洗、AI 分析、运营配置、输出生成和结果追踪。
- **Connector**：单个数据源的独立接入模块，例如 Reddit、YouTube、TikTok、Etsy、Pinterest 或关键词工具。
- **Raw Item**：未被修改的原始数据记录，保留原始 payload、来源 URL、指标和抓取时间。
- **Normalized Item**：由 Raw Item 转换而来的统一数据结构，包含标题、正文、作者、媒体、指标、语言、标签和互动分数等通用字段。
- **Enrichment**：AI 或规则对 Normalized Item 做的结构化增强，例如痛点、意图、趋势类型、关键词、内容角度和机会分数。
- **Opportunity**：可以被执行的增长机会，例如 SEO 页面、短视频角度、产品落地页、KOC/KOL 目标或分发实验。
- **Workflow Config**：运营可配置的工作流定义，包含数据源、关键词、过滤条件、Prompt 版本、输出模板、审核门槛、调度和目标渠道。
- **Workflow Run**：一次 Workflow Config 的执行记录，包含数据提取、归一化、AI 增强、输出生成和运行日志。
- **Output Asset**：可供审核或执行的生成结果，例如 SEO brief、内容选题、社媒草稿、图片 Prompt、CSV 导出或触达消息。
- **Execution Channel**：Output Asset 被发送到的下游系统，例如 Google Sheets、Notion、Slack、飞书、WordPress、Webflow、Shopify、TikTok、Pinterest 或邮件。
- **Feedback Signal**：执行后的效果数据，例如曝光、点击、收藏、评论、回复、注册、转化或收入。

## MVP 范围

第一个可用版本要证明一个完整闭环：

1. 运营配置产品方向和关键词。
2. 系统从 Reddit 和一个视觉或电商数据源提取数据。
3. 系统保存 Raw Item，并生成 Normalized Item。
4. 系统用 AI 提取痛点、意图、趋势标签、内容角度和机会分数。
5. 运营审核排序后的 Opportunity。
6. 系统生成 SEO brief 和短视频选题。
7. 运营导出 Markdown 或 CSV。

第一个演示垂类固定为 AI tattoo generator。这个方向可以同时覆盖 Reddit 讨论、Etsy 商品、Pinterest 视觉趋势、TikTok/YouTube 内容传播和 SEO/内容工作流。

## MVP 不做什么

- 不做全平台自动发布。
- 不做投放优化。
- 不做复杂多租户计费。
- 不做企业级权限系统。
- 不做通用版 Zapier。
- 不在一个闭环跑通前接入所有数据源。

## 架构语言

- **Extraction layer**：负责 Connector 和 Raw Item。
- **Normalization layer**：负责 Normalized Item、去重、语言识别和指标标准化。
- **Enrichment layer**：负责 AI Prompt、结构化输出、评分和可复用分类器。
- **Configuration layer**：负责 Workflow Config、模板、调度和审核门槛。
- **Execution layer**：负责 Workflow Run、输出生成、导出、通知和下游集成。
- **Feedback layer**：负责活动指标和评分优化。
