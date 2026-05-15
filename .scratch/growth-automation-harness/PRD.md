# PRD：Growth Automation Harness

Status: ready-for-agent

## 问题陈述

海外 C 端产品的增长工作分散在大量手动流程里。运营需要手动浏览 Reddit、TikTok、YouTube、Etsy、Pinterest、搜索趋势、评论、商品列表和创作者主页，再把数据复制到表格里，归纳模式，写内容选题，准备 SEO 页面，寻找 KOC/KOL，并手动追踪后续效果。

这会带来三个问题：

1. 增长信号发现不稳定，容易错过有价值机会。
2. 不同平台字段、指标和格式不一致，数据很难横向比较。
3. 很多重复流程必须依赖工程师改代码，无法由运营自己配置。

平台要把增长发现和执行变成一个可重复的自动化系统：提取数据、清洗数据、分析数据、配置工作流、生成资产并追踪结果。

## 解决方案

构建一个可配置的 Growth Automation Harness。第一个作品集演示垂类固定为 **AI tattoo generator**，第一个版本要支持一个窄而完整的闭环：

1. 运营配置产品方向、关键词、数据源、过滤条件、AI Prompt、输出模板和调度。MVP 默认产品方向为 AI tattoo generator。
2. 系统从 Reddit 和一个视觉或电商数据源提取原始数据，例如 Etsy 或 Pinterest。
3. 系统先保存 Raw Item，再做后续转换。
4. 系统把不同来源的数据归一化成统一的 Normalized Item。
5. 系统用 AI 做结构化增强：痛点、意图、趋势类型、关键词、内容角度和机会分数。
6. 系统聚合并排序 Opportunity。
7. 系统生成 Output Asset，例如 SEO brief、短视频选题、素材 Prompt、KOC/KOL 列表或触达草稿。
8. 运营审核、导出，并在后续记录 Feedback Signal。

MVP 应该是一个可以指导产品和工程实现的目标，而不是一个泛化的低代码平台。它要证明数据提取、数据清洗、AI 增强和运营配置可以组成一个完整增长闭环。

## 用户故事

1. 作为增长运营，我想配置产品方向和关键词，以便发现任务聚焦在我要推广的产品上。
2. 作为增长运营，我想选择数据源 Connector，以便扫描最相关的用户渠道。
3. 作为增长运营，我想配置时间范围、语言和最低互动量过滤条件，以便提前排除低质量数据。
4. 作为增长运营，我想手动运行一个工作流，以便在定时执行前先验证配置。
5. 作为增长运营，我想设置周期性运行，以便趋势发现不依赖每天手动执行。
6. 作为增长工程师，我想让每个 Connector 都隔离在稳定接口后面，以便平台 API 或爬取逻辑变化不会污染系统其他部分。
7. 作为增长工程师，我想原样保存 Raw Item，以便 AI 增强逻辑变化时可以重放历史数据。
8. 作为增长工程师，我想使用统一的 Normalized Item，以便分析逻辑不依赖具体来源的 schema。
9. 作为增长工程师，我想基于 URL、标题、作者和内容 hash 去重，以便重复信号不会扭曲机会评分。
10. 作为内容运营，我想让 AI 提取用户痛点，以便快速理解用户为什么关心某个趋势。
11. 作为内容运营，我想让 AI 生成内容角度，以便把发现到的信号转化为帖子、脚本和页面 brief。
12. 作为内容运营，我想配置 Prompt 模板，以便不改代码也能调整输出风格。
13. 作为内容运营，我想配置 SEO brief 模板，以便生成结果能直接变成落地页或博客 brief。
14. 作为商务/达人运营，我想提取并评分 KOC/KOL 候选人，以便从有证据的名单开始触达。
15. 作为商务/达人运营，我想基于来源上下文生成触达话术，以便消息更具体，而不是模板化群发。
16. 作为创始人或增长负责人，我想看到带证据的机会分数，以便决定哪些增长实验值得投入资源。
17. 作为创始人或增长负责人，我想查看工作流运行历史，以便比较不同运行之间发生了什么变化。
18. 作为创始人或增长负责人，我想把 Feedback Signal 记录到活动上，以便未来优化机会评分。
19. 作为运营，我想把结果导出为 Markdown 或 CSV，以便在深度集成前也能使用平台产出。
20. 作为运营，我想在发布或触达前设置人工审核门槛，以便自动化不会发送未经确认的内容。
21. 作为运营，我想配置黑名单和白名单，以便稳定处理已知低质来源或优先创作者。
22. 作为运营，我想每条洞察都保留来源 URL，以便回看原始证据。
23. 作为增长工程师，我想记录工作流日志和失败步骤，以便排查 Connector 或 AI 增强失败。
24. 作为增长工程师，我想对 AI 输出做 schema 校验，以便模型返回异常格式时不会破坏下游流程。
25. 作为增长工程师，我想保存 Prompt 版本，以便旧输出可以追溯到当时使用的 Prompt。

## 实现决策

- 系统按六层设计：Extraction、Normalization、Enrichment、Configuration、Execution、Feedback。
- Extraction layer 负责 Connector 和 Raw Item。Connector 暴露小接口：接收 Workflow Config 中的数据源配置，返回 Raw Item 和抓取元数据。
- 第一个 Connector 选择 Reddit，因为它最适合从帖子和评论里发现用户痛点。
- 第二个 Connector 选择 Etsy 或 Pinterest。Etsy 更适合验证商业需求，Pinterest 更适合验证视觉趋势。
- 第一个演示场景固定为 AI tattoo generator。默认关键词包括 `ai tattoo`、`tattoo generator`、`minimal tattoo`、`fine line tattoo`、`tattoo ideas`、`custom tattoo design`。
- DeepSearch 的第一版证据链围绕四类问题：用户为什么需要 AI tattoo、哪些纹身风格正在流行、哪些商品或设计有购买需求、哪些内容角度适合 SEO 和短视频传播。
- Raw Item 必须保存 source、external id、source URL、title、content、author、metrics JSON、raw JSON 和 fetched timestamp。
- Normalized Item 必须包含 source、title、text、media URLs、author、normalized engagement score、published timestamp、language、tags 和 source URL。
- Enrichment 必须输出结构化 JSON。第一版 schema 包含 pain points、intent、trend type、keywords、content angles、evidence summary 和 opportunity score。
- Workflow Config 必须把 sources、keywords、filters、prompt versions、templates、schedules 和 destinations 当作运营配置管理。
- Workflow Run 必须记录步骤状态、计数、错误和生成的 Output Asset。
- 输出生成先支持 Markdown 和 CSV，不要先做外部自动发布集成。
- 未来任何自动发布或自动触达，都必须先经过 review gate。
- Feedback Signal 要提前设计，但 MVP 可以先支持手动录入指标或 CSV 导入，不必一开始做活动平台 API 集成。
- 系统不应该变成通用低代码自动化平台。它的领域是海外 C 端产品的增长发现和增长执行。

## 测试决策

- 测试外部行为，不测试私有实现细节。
- Connector 测试要验证源响应能转换成 Raw Item，并验证字段缺失或限流时能以可预期方式失败。
- Normalization 测试要验证 Raw Item 到 Normalized Item 的稳定转换，包括去重、语言处理、指标标准化和 URL 保留。
- Enrichment 测试要验证 schema 解析、必填字段、分数范围，以及 AI 返回异常格式时的兜底行为。
- Workflow Config 测试要验证过滤条件、Prompt 版本、输出模板和调度配置会被正确解释。
- Workflow Run 测试要验证步骤顺序、失败记录、重试边界和生成资产引用。
- Opportunity scoring 测试要使用接近真实来源模式的 fixture，例如高互动帖子、重复商品、低信号评论和创作者主页。
- UI 测试聚焦运营路径：创建工作流、运行工作流、审核机会、查看来源证据、导出结果。

## 不在范围内

- 第一版不做完整 TikTok 自动化。
- 不做全自动社媒发布。
- 不做人审前的邮件或私信发送。
- 不做广告投放优化。
- 不做多租户计费。
- 不做企业级 RBAC。
- 不做 Zapier、n8n、Coze 或 Dify 这样的通用工作流产品。
- 在 Reddit 加一个视觉或电商数据源的闭环跑通前，不接入所有数据源。

## 补充说明

这个项目应该被包装成增长工程系统，而不是普通爬虫或 Prompt 套壳。最强的面试叙事是：

- 它主动发现增长机会，而不是等运营提出需求。
- 它保留从 Raw Item 到 Normalized Item，再到 Enrichment、Opportunity、Output Asset 的完整数据链路。
- 它把 Prompt、模板、过滤条件和调度都做成运营可配置。
- 它支持 SEO 页面 brief、社媒内容生成、KOC/KOL 发现和数据驱动的活动复盘。
- 第一个 demo 用 AI tattoo generator，可以自然串起 Reddit、Etsy、Pinterest、TikTok/YouTube、SEO 和 KOC/KOL 触达。
- 它给未来集成留了空间，但 MVP 仍然足够小，可以真实实现。
