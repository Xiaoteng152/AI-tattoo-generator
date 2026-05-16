# Growth Automation Harness 版本任务路线图

## 定位

目标是做一个可以放进 Agent 作品集的增长自动化平台。第一个演示垂类固定为 **AI tattoo generator**。它不只是爬虫或 Prompt 工具，而是一个能展示 Agent 能力链路的系统：

1. 自动理解增长目标。
2. 主动拆解搜索和数据采集计划。
3. 多源提取数据。
4. 清洗、去重、归一化。
5. 用 AI 做结构化分析。
6. 生成可执行的增长资产。
7. 记录证据、过程和结果。

AI tattoo generator 被选为第一个 demo，是因为它能自然串起 Reddit 痛点、Etsy 商业需求、Pinterest 视觉趋势、TikTok/YouTube 内容传播、SEO brief、图片 Prompt 和 KOC/KOL 触达。

## 学习和 AI 协作方式

这个项目不要求纯手写完成整个 Agent 设计。更好的方式是：自己负责架构判断、产品取舍和关键实现，AI 负责加速代码、补模板、拆任务、写测试和做局部实现。

作品集真正有价值的部分，不是证明每一行代码都亲手写，而是能解释为什么系统这样设计，以及每个模块如何支撑真实业务目标。

### 必须自己掌握的部分

| 模块 | 需要掌握到什么程度 |
| --- | --- |
| Agent loop | 能讲清楚 Plan -> Tool Use -> Observation -> Reasoning -> Action 的循环怎么跑 |
| Tool router | 能解释为什么工具要统一接口，Reddit/Etsy/Pinterest 工具如何注册和调用 |
| Run state | 能说明一次 DeepSearch Run 需要保存哪些状态，为什么要持久化 |
| Context compression | 能解释为什么不能把所有搜索结果塞回模型，而要压缩成 Evidence Bundle / Run Summary |
| Schema design | 能解释 DeepSearchPlan、Evidence、Opportunity 为什么这样设计 |
| Failure handling | 能说明工具失败、LLM 输出坏格式、部分数据源失败时怎么恢复 |
| Product boundary | 能说明为什么先做受控 DeepSearch，而不是一开始做泛化搜索引擎 |

### 可以大量交给 AI 加速的部分

| 模块 | AI 可以怎么帮 |
| --- | --- |
| 数据库 schema | 根据 PRD 生成 Prisma schema 和 migration |
| Connector 初版 | 生成 mock Reddit connector，后续再接真实 API 或爬虫 |
| UI 页面 | 生成 dashboard、workflow、opportunity、DeepSearch report 页面 |
| Prompt 模板 | 起草 Planner、Enrichment、SEO brief、KOC/KOL outreach prompt |
| 测试 | 根据外部行为生成单测和 fixture |
| 文档 | 更新 PRD、task.md、README、架构说明和作品集介绍 |
| 重构 | 按模块边界整理代码，提取深模块 |

### 推荐学习节奏

不要只看课，也不要只让 AI 写。最有效的节奏是：

1. 先学一节课程。
2. 自己写 5-10 行理解笔记。
3. 让 AI 把这一节映射到 Growth Automation Harness。
4. 自己判断映射是否合理。
5. 让 AI 生成代码、schema、prompt 或 task。
6. 自己运行、调试，并追问为什么这样设计。

## Learn Claude Code s01-s06 对应实现

当前学习进度到 s06，可以先把前六节映射到本项目。

| 课程 | 本项目里需要理解什么 | 可以落地的实现 |
| --- | --- | --- |
| s01 Agent 循环 | DeepSearch 为什么不是单次 LLM 调用，而是多步循环 | 最小 DeepSearch loop：plan -> search -> observe -> synthesize |
| s02 工具使用 | Connector 为什么属于工具层 | Tool / Connector interface，mock Reddit tool |
| s03 待办写入 | 多步骤研究为什么需要可见计划 | DeepSearch Plan、Workflow Run、run_steps |
| s04 子代理 | 什么时候拆 Research Agent、Content Agent、Review Agent | 先画 agent 分工，不急着实现多 agent |
| s05 技能系统 | skill、prompt template、tool 的边界 | Tattoo growth skill、SEO brief template、KOC/KOL outreach template |
| s06 上下文压缩 | 为什么要压缩搜索结果，而不是把全部原文塞给模型 | Evidence Bundle、Run Summary、DeepSearch Report |

### s06 在本项目里的关键设计

DeepSearch 最大的工程问题是上下文爆炸。一次运行可能拿到：

- 50 条 Reddit 帖子和评论。
- 100 个 Etsy 商品。
- 80 个 Pinterest pins。
- 20 个关键词趋势结果。

这些内容不能全部塞进 LLM。系统应该先压缩成结构化证据包，再交给后续 synthesis 或 output generation。

推荐第一版 Evidence Bundle 结构：

```ts
type EvidenceBundle = {
  opportunityCandidate: string
  sources: {
    source: "reddit" | "etsy" | "pinterest" | "google_trends"
    keyFindings: string[]
    representativeEvidence: {
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

1. 每个来源只保留最有代表性的 3-5 条证据。
2. 每条证据必须保留 URL。
3. `whyItMatters` 必须说明它证明了什么：痛点、商业需求、视觉趋势、搜索需求或内容传播。
4. 不允许没有证据的结论进入 Opportunity。
5. 压缩后的 summary 要能被后续 SEO brief、短视频选题和 KOC/KOL 触达复用。

## 下一步建议

在写完整平台代码前，先新增一份 `agent-design.md`，只描述 DeepSearch Agent 的最小设计：

1. Agent loop 怎么跑。
2. 有哪些 tools。
3. run state 存什么。
4. context 怎么压缩。
5. failure 怎么处理。
6. 输出什么 report。

完成 `agent-design.md` 后，再让 AI 根据这个设计生成 V0/V1 的代码。这样你既能利用 AI 加速，又能保证作品集里的核心设计是自己理解过的。

## DeepSearch 设计结论

要设计 DeepSearch，但不要在 V0 就做成泛化搜索引擎。

这里的 DeepSearch 应该定义为“面向 AI tattoo generator 增长机会发现的 Agent 深搜工作流”，而不是简单的联网搜索。它要能根据产品方向自动生成搜索计划，跨 Reddit、Etsy、Pinterest、YouTube、TikTok、Google Trends、关键词工具等渠道收集证据，最后输出带来源证据的 Opportunity。

DeepSearch 是作品集亮点，因为它能体现：

- Agent 会规划，而不是只执行固定脚本。
- Agent 会多轮搜索，而不是只查一次关键词。
- Agent 会保留证据链，而不是只给结论。
- Agent 会把发现转成 SEO brief、内容选题、KOC/KOL 触达等增长动作。

MVP 里先做“受控 DeepSearch”：固定搜索范围、固定步骤、固定输出 schema。等闭环跑通后，再做更开放的多轮搜索和自动追问。

## V0：项目骨架和本地可运行闭环

### 目标

搭出最小工程骨架，让平台可以本地运行，并完成一次手动工作流。

### 任务步骤

1. 初始化 Next.js 项目。
2. 配置 TypeScript、Tailwind、shadcn/ui。
3. 配置 Prisma 和 PostgreSQL。
4. 配置 Redis 和 BullMQ。
5. 建立基础目录结构：
   - `src/modules/connectors`
   - `src/modules/extraction`
   - `src/modules/normalization`
   - `src/modules/enrichment`
   - `src/modules/scoring`
   - `src/modules/workflow`
   - `src/modules/output`
   - `src/workers`
6. 建立数据库表：
   - `workflow_configs`
   - `workflow_sources`
   - `workflow_runs`
   - `run_steps`
   - `raw_items`
   - `normalized_items`
   - `enrichments`
   - `opportunities`
   - `output_assets`
7. 做一个本地 seed workflow：
   - 产品方向：AI tattoo generator
   - 关键词：`ai tattoo`、`minimal tattoo`、`tattoo ideas`
   - 数据源：mock Reddit
8. 实现一次手动运行：
   - 创建 run
   - 读取 mock raw data
   - 写入 Raw Item
   - 转换 Normalized Item
   - 生成简单 Opportunity
   - 生成 Markdown 输出

### 验收标准

- 本地可以启动前端。
- 数据库 migration 可以正常执行。
- 点击或调用 API 后，可以生成一次 Workflow Run。
- 数据库里能看到 Raw Item、Normalized Item、Opportunity、Output Asset。
- 输出一个 Markdown 格式的 SEO brief 或内容选题。

### 作品集展示点

- 展示系统不是单脚本，而是有清晰的数据链路。
- 展示 Raw Item 到 Output Asset 的完整流转。
- 展示后续可以接真实 Connector 和 AI。

## V1：Reddit 数据提取和 AI 增强

### 目标

把 mock 数据替换为 Reddit Connector，并接入 LLM 做结构化分析。

### 任务步骤

1. 实现 `Connector` 接口。
2. 实现 Reddit Connector：
   - 支持 subreddit 搜索。
   - 支持关键词搜索。
   - 支持抓帖子标题、正文、作者、评论数、upvotes、URL、发布时间。
3. 写入 Raw Item：
   - 用 `source + external_id` 或 `source_url` 做幂等。
4. 实现 Reddit Normalizer：
   - 标题和正文合并为分析文本。
   - 标准化互动分数。
   - 保留来源 URL。
5. 接入 LLM Provider 抽象：
   - `generateStructuredObject`
   - `model`
   - `promptVersion`
6. 设计 Enrichment schema：
   - `pain_points`
   - `intent`
   - `trend_type`
   - `keywords`
   - `content_angles`
   - `evidence_summary`
   - `opportunity_score`
7. 对 Normalized Item 批量执行 AI 增强。
8. 实现 Opportunity Scorer：
   - 结合互动分数、痛点强度、商业意图和内容可执行性。
9. 做 Opportunities 页面：
   - 列表
   - 分数
   - 类型
   - 证据来源
   - 原始 URL

### 验收标准

- 输入关键词后，可以抓取 Reddit 数据。
- 每条数据能生成结构化 Enrichment。
- Opportunity 有分数和证据摘要。
- 页面能查看机会和来源 URL。
- AI 返回异常时，不会中断整个 Workflow Run。

### 作品集展示点

- 展示真实数据源接入能力。
- 展示 LLM 结构化输出能力。
- 展示证据链和评分逻辑。

## V1.5：受控 DeepSearch

### 目标

加入作品集核心亮点：Agent 可以根据增长目标自动生成搜索计划，并多轮收集证据。

### 任务步骤

1. 新增 DeepSearch Plan 数据结构：
   - `goal`
   - `target_audience`
   - `seed_keywords`
   - `search_questions`
   - `source_plan`
   - `expected_outputs`
2. 新增 DeepSearch Planner：
   - 输入产品方向。
   - 自动生成要验证的问题。
   - 自动扩展关键词。
   - 自动决定要查哪些来源。
3. 第一版 source plan 固定支持：
   - Reddit：用户痛点和讨论热度。
   - Etsy 或 Pinterest：商业/视觉趋势验证。
   - Google Trends 或关键词工具：搜索需求验证。
4. 第一版默认验证问题：
   - 用户为什么想用 AI tattoo generator？
   - 用户在纹身设计前最担心什么？
   - 哪些 tattoo 风格正在 Reddit、Pinterest、Etsy 中反复出现？
   - 哪些关键词有 SEO 页面机会？
   - 哪些短视频内容角度可能传播？
   - 哪些纹身师、设计师或内容创作者适合做 KOC/KOL 触达？
5. 新增 DeepSearch Run：
   - 记录 plan。
   - 记录每轮搜索查询。
   - 记录每个来源返回数量。
   - 记录被采纳和被过滤的数据。
6. 新增 Evidence Bundle：
   - 把多个来源的证据聚合到同一个 Opportunity。
7. 新增 DeepSearch Report：
   - 机会摘要。
   - 证据来源。
   - 置信度。
   - 推荐增长动作。
   - 下一步搜索建议。
8. 前端新增 DeepSearch 页面：
   - 输入产品方向。
   - 查看搜索计划。
   - 点击运行。
   - 查看证据链和报告。

### 验收标准

- 输入 `AI tattoo generator` 后，系统能生成搜索计划。
- 搜索计划至少包含 5 个验证问题。
- 系统能跨至少 2 个来源收集证据。
- DeepSearch Report 能解释为什么某个 Opportunity 值得做。
- 每个结论都能点击回到来源证据。

### 作品集展示点

- 展示 Agent Planning。
- 展示 Multi-step Research。
- 展示 Evidence-grounded Generation。
- 展示从调研到增长动作的闭环。

## V2：运营配置后台

### 目标

让平台从工程 demo 变成运营可配置产品。

### 任务步骤

1. 实现 Workflow Config CRUD：
   - 名称
   - 产品方向
   - 关键词
   - 数据源
   - 过滤条件
   - 输出类型
2. 实现 Source Config：
   - Reddit subreddit
   - 查询关键词
   - 时间范围
   - 最低互动量
3. 实现 Prompt Template 管理：
   - Enrichment Prompt
   - SEO Brief Prompt
   - Social Content Prompt
   - KOC/KOL Outreach Prompt
4. 实现 Output Template 管理：
   - SEO brief
   - 短视频选题
   - 社媒文案
   - KOC/KOL 触达列表
5. 实现 Review Gate：
   - 草稿
   - 已审核
   - 已导出
   - 已废弃
6. 实现 Run History：
   - 每次运行状态
   - step logs
   - 错误信息
   - 生成数量
7. 实现 Markdown / CSV 导出。

### 验收标准

- 运营可以不改代码创建一个 Workflow。
- 运营可以调整 Prompt 和输出模板。
- 每次运行都能查看日志。
- 输出可以审核和导出。

### 作品集展示点

- 展示你理解“运营配置”，不是只会写脚本。
- 展示 PromptOps 和模板化能力。
- 展示面向真实业务人员的产品化能力。

## V3：第二数据源和跨源机会聚合

### 目标

接入 Etsy 或 Pinterest，并把 Reddit 用户痛点和视觉/商业趋势合并分析。

### 任务步骤

1. 实现 Etsy 或 Pinterest Connector。
2. 为新数据源建立 Raw Item 映射。
3. 实现对应 Normalizer。
4. 做跨源 Deduplication：
   - 标题相似度
   - URL 唯一性
   - 关键词重叠
5. 做 Cross-source Opportunity：
   - Reddit 证明用户痛点。
   - Etsy 证明购买需求。
   - Pinterest 证明视觉趋势。
6. 优化 Opportunity Score：
   - 用户痛点分
   - 商业需求分
   - 内容传播分
   - 来源覆盖分
7. 在 Opportunity 页面展示证据矩阵。

### 验收标准

- 至少两个真实数据源跑通。
- 一个 Opportunity 可以挂多个来源证据。
- 页面能说明不同来源分别证明了什么。

### 作品集展示点

- 展示多源数据融合。
- 展示增长判断不是单点结论。
- 展示更接近真实增长团队的工作方式。

## V4：内容和 SEO 资产生成

### 目标

把 Opportunity 转成可执行的增长资产。

### 任务步骤

1. 实现 SEO Brief Generator：
   - 页面标题
   - 搜索意图
   - 目标关键词
   - 页面结构
   - FAQ
   - 内容角度
   - CTA 建议
2. 实现 Social Content Generator：
   - TikTok/Reels 选题
   - Hook
   - 脚本结构
   - Caption
   - Hashtags
3. 实现 Image Prompt Generator：
   - Pinterest 风格图 Prompt
   - 商品展示 Prompt
   - before/after Prompt
4. 实现 KOC/KOL Outreach Generator：
   - 候选人摘要
   - 匹配理由
   - 私信模板
   - 跟进状态
5. Output Assets 页面支持：
   - 按类型筛选。
   - 编辑内容。
   - 审核状态。
   - 导出。

### 验收标准

- 每个 Opportunity 至少能生成一种 Output Asset。
- SEO brief 和短视频选题质量足够展示给面试官。
- 输出内容保留来源证据引用。

### 作品集展示点

- 展示 Agent 不只调研，还能生成业务产出。
- 展示从证据到内容资产的可解释链路。

## V5：反馈回流和复盘

### 目标

让平台从“生成建议”升级为“持续优化增长系统”。

### 任务步骤

1. 新增 Feedback Signal 表单：
   - 平台
   - 曝光
   - 点击
   - 收藏
   - 评论
   - 注册
   - 收入
2. 支持 CSV 导入活动结果。
3. 把 Feedback Signal 关联到 Output Asset。
4. 建立复盘页面：
   - 哪些机会被执行。
   - 哪些输出表现最好。
   - 哪些来源信号更可靠。
5. 优化 Opportunity Score：
   - 引入历史表现权重。
   - 标记高质量来源。
   - 降低低质量信号来源权重。
6. 生成 Retrospective Report：
   - 本周发现了什么。
   - 执行了什么。
   - 哪些有效。
   - 下一轮该搜索什么。

### 验收标准

- 可以录入或导入执行结果。
- 可以看到 Output Asset 的表现。
- 下一轮 Opportunity Score 能参考历史反馈。

### 作品集展示点

- 展示闭环增长系统。
- 展示你不是只做“生成”，而是做“验证和复盘”。

## 版本优先级

建议实现顺序：

1. V0：本地闭环。
2. V1：Reddit + AI 增强。
3. V1.5：受控 DeepSearch。
4. V2：运营配置后台。
5. V3：第二数据源和跨源机会聚合。
6. V4：内容和 SEO 资产生成。
7. V5：反馈回流和复盘。

如果时间有限，作品集最小展示版本应该做到 V1.5。这样能清楚展示 Agent Planning、真实数据提取、结构化分析和证据链。

## 当前已确认决策

DeepSearch 的第一个演示场景固定为 `AI tattoo generator`。

默认 seed keywords：

- `ai tattoo`
- `tattoo generator`
- `minimal tattoo`
- `fine line tattoo`
- `tattoo ideas`
- `custom tattoo design`

默认首批数据源：

- Reddit：用户痛点和真实讨论。
- Etsy：商业需求和商品化设计验证。
- Pinterest：视觉趋势和风格验证。
- Google Trends 或关键词工具：搜索需求验证。

TikTok 和 YouTube 放到后续版本，用来增强内容传播分析。

## 基于当前仓库状态的下一阶段迭代规划

当前仓库已经完成了 V0/V1 的大部分主链路：Next.js 页面、Prisma schema、Workflow Run、Reddit/Etsy connector、OpenAI-compatible enrichment、rules fallback、Opportunity scoring、Markdown SEO brief、Backtest 和 Dashboard 都已经存在。

所以后续不要回头重做脚手架，应该直接围绕 DeepSearch 和运营化能力继续迭代。

### 当前状态判断

| 能力 | 当前状态 | 后续处理 |
| --- | --- | --- |
| Next.js 本地应用 | 已有 | 保留，继续扩页面 |
| Prisma 数据模型 | 已有主链路表 | 新增 DeepSearch 和 Feedback 相关表 |
| Workflow Run | 已有 | 增加 DeepSearch Run 和更细 step metadata |
| Reddit Connector | 已有真实搜索 | 保留，补搜索问题和查询来源记录 |
| Etsy Connector | 已有 API 接入点 | 保留，后续补商业证据字段 |
| mock fallback | 已有 | 改成 tattoo 领域，不再用 crypto/twitter 示例 |
| AI Enrichment | 已有 OpenAI-compatible + rules fallback | 保留，后续接 Planner/Summarizer |
| Opportunity scoring | 已有逐条 item 评分 | 升级为跨源 Evidence Bundle 评分 |
| Output Asset | 已有 Markdown SEO brief | 扩展到短视频选题、Pinterest Prompt、KOC/KOL outreach |
| Dashboard | 已有单页 | 拆成 Dashboard / DeepSearch / Outputs / Workflows |

### P0：先修正 MVP 一致性

目标：让当前 demo 完全围绕 AI tattoo generator，不再出现 crypto 或不相关默认值。

任务：

1. 把 Backtest 默认 productDirection 从“比特币增长机会”改成 `AI tattoo generator`。
2. 把默认关键词改成 `ai tattoo`、`tattoo generator`、`minimal tattoo`、`fine line tattoo`、`custom tattoo design`。
3. 移除或替换 `mock-twitter` 中的 crypto 内容。
4. 首页文案统一为 Reddit / Etsy / Pinterest / Trends，不再强调 X/Twitter。
5. 检查 README、CONTEXT、task.md、product-flow 中的数据源描述是否一致。

验收：

- 本地首页、backtest、README 都只围绕 AI tattoo generator 讲故事。
- 没有默认 crypto 示例出现在主要用户路径里。
- 运行 backtest 时，输出能自然解释 tattoo 相关机会。

### V1.5：DeepSearch Agent 最小实现

目标：把当前“直接抓数据并逐条分析”升级为“先规划、再搜索、再压缩证据、再合成结论”的 Agent 工作流。

任务：

1. 新增 `agent-design.md`，明确 DeepSearch Agent 的 loop、tools、state、context compression、failure handling 和 report 输出。
2. 新增 DeepSearch 数据结构：
   - `DeepSearchPlan`
   - `DeepSearchRun`
   - `DeepSearchQuestion`
   - `EvidenceBundle`
   - `DeepSearchReport`
3. 实现 Planner：输入 `AI tattoo generator`，生成 5-8 个研究问题和 source routing。
4. 实现 Query Expansion：每个问题生成 3-5 个查询词。
5. 复用现有 Reddit/Etsy connector 做第一版工具调用。
6. 新增 Evidence Selector：每个来源保留 3-5 条代表证据。
7. 新增 Evidence Bundle 压缩：把多源证据压成可追溯摘要。
8. 新增 DeepSearch Report：输出机会、证据、置信度、推荐增长动作。
9. 新增 `/deepsearch` 页面：展示 plan、source progress、evidence bundle、report。

验收：

- 点击运行 DeepSearch 后，先看到搜索计划，而不是直接看到结果。
- 每个 Opportunity 至少有 2 条来源证据。
- 每个结论都能追溯到 URL。
- DeepSearch Report 不允许出现无证据结论。

### V2：运营配置后台

目标：把 demo 变成运营可配置产品，而不是写死的单流程。

任务：

1. 新增 Workflows 页面：配置产品方向、关键词、数据源、过滤条件。
2. 新增 Prompt Templates 页面：管理 Planner、Enrichment、SEO brief、Outreach prompt。
3. 新增 Output Templates 页面：管理 SEO brief、短视频选题、Pinterest Prompt、KOC/KOL outreach 模板。
4. 新增 Run History 页面：查看每次 run 的 step logs、错误、输入输出数量。
5. 新增 Output Assets 页面：审核、编辑、导出 Markdown/CSV。
6. 为 Output Asset 增加更完整的审核状态和导出记录。

验收：

- 不改代码也能创建一个新 workflow。
- 不改代码也能调整 prompt 和输出模板。
- 每次运行都有可查看的过程记录。
- 输出资产可以被审核、编辑、导出。

### V3：跨源证据矩阵

目标：从“单条数据生成机会”升级为“多来源证据共同证明机会”。

任务：

1. 新增 Pinterest 或 Google Trends connector。
2. 实现跨源 dedupe 和 clustering。
3. 新增 Evidence Matrix：按 Opportunity 展示 Reddit / Etsy / Pinterest / Trends 分别证明了什么。
4. 升级 Opportunity Score：综合痛点强度、商业需求、视觉趋势、搜索需求、来源覆盖。
5. 在 UI 中展示证据矩阵，而不是只展示 sourceUrls 数量。

验收：

- 一个 Opportunity 能聚合多个来源证据。
- UI 能解释不同来源分别证明了什么。
- 评分不再只依赖单条 enrichment，而是依赖 evidence bundle。

### V4：增长资产生成工厂

目标：把 Opportunity 转成多类型可执行资产。

任务：

1. SEO brief generator：标题、搜索意图、页面结构、FAQ、CTA。
2. Short video generator：Hook、脚本结构、caption、hashtags。
3. Pinterest Prompt generator：视觉风格、构图、纹身位置、生成约束。
4. KOC/KOL outreach generator：匹配理由、私信模板、跟进状态。
5. Output Assets 页面支持按类型筛选、编辑、审核、导出。

验收：

- 每个高分 Opportunity 至少能生成 2 种 Output Asset。
- 输出内容保留来源证据引用。
- 生成资产可以被运营审核和编辑。

### V5：反馈回流和复盘

目标：让系统从“生成建议”升级为“持续优化增长系统”。

任务：

1. 新增 FeedbackSignal 数据表。
2. 支持录入曝光、点击、收藏、评论、注册、收入。
3. 支持 CSV 导入执行结果。
4. 把 Feedback Signal 关联到 Output Asset 和 Opportunity。
5. 新增 Retrospective Report：本周发现、执行、有效、下一轮搜索建议。
6. 让历史反馈影响下一轮 Opportunity Score。

验收：

- 能看到哪些资产被执行，效果如何。
- 下一轮评分能参考历史表现。
- 复盘报告能说明下一步该搜索什么。

## DeepSeek 和 DeepSearch 的关系

当前可以先用 DeepSeek 或 OpenAI-compatible 模型做 LLM 推理，但不要把“调用 DeepSeek 搜索/回答”当成 DeepSearch 本身。

本项目的目标是自己实现 DeepSearch 的系统能力：

1. 自己定义 Agent loop。
2. 自己定义 tools/connectors。
3. 自己保存 run state。
4. 自己做 query planning 和 source routing。
5. 自己做 evidence selection 和 context compression。
6. 自己生成可追溯 report。

DeepSeek 可以作为其中一个 LLM Provider，用来做 Planner、Enrichment、Summarizer 或 Report Writer。它不应该替代你的 DeepSearch 编排层。

面试表达可以这样说：

> 我没有把 DeepSearch 做成“调用一个搜索型模型然后显示答案”。我实现的是一个受控 Agent pipeline：先规划问题，再调用多源工具，再压缩证据，再合成机会，最后生成可执行增长资产。DeepSeek/OpenAI 只是其中的推理模型，系统的状态、工具、证据链和产出流程是我自己实现的。

## DeepSearch Agent 初版自测清单 2026-05-16

本清单用于对照 `agent-design.md` 检查当前 DeepSearch Agent 初版是否满足作品集 demo 的最小闭环。状态词：

- `[x]` 已实现并通过本地自测。
- `[~]` 有初版实现，但还不是最终形态。
- `[ ]` 尚未实现，进入下一阶段。

### Agent Loop

- [x] Plan：`src/modules/deepsearch/planner.ts` 已能按 AI tattoo generator 生成默认研究计划。
- [x] Route：`runner.ts` 已按 question.sources 路由到 Reddit、Etsy、X/Twitter connector。
- [x] Search：已复用现有 connector 执行真实 Reddit、SoPilot-backed X/Twitter，以及 Etsy/mock fallback。
- [x] Observe：Runner 已生成 Raw Item 风格 observation，并复用 `normalizeRawItem` 生成 Normalized Record。
- [x] Enrich：已复用 `enrichItem`，支持 OpenAI-compatible 模型和 rules fallback。
- [x] Compress：`evidence-compressor.ts` 已按 question/source 生成 Evidence Bundle。
- [x] Synthesize：`report-writer.ts` 已从 Evidence Bundle 生成 Top Opportunities 和 DeepSearch Report。
- [~] Act：报告里已生成推荐动作，但尚未真正创建 SEO brief、短视频脚本、Pinterest Prompt、KOC/KOL outreach 等 Output Asset。

### 数据模型和持久化

- [x] Prisma schema 已新增 `DeepSearchRun`、`DeepSearchPlan`、`DeepSearchQuestion`、`EvidenceBundle`、`DeepSearchReport`。
- [x] 已新增 migration 草案：`prisma/migrations/20260516000000_deepsearch_agent/migration.sql`。
- [~] 当前 Runner 仍是内存执行版本；schema 已准备好，但还没有把 run state、plan、bundle、report 写入数据库。
- [ ] 还没有实现失败恢复、历史 run 查询和 run detail 页面。

### Planner

- [x] 规则版 Planner 已生成 6 个默认问题：痛点、设计前顾虑、风格趋势、SEO、内容传播、KOC/KOL。
- [x] 每个问题包含 intent、sources 和 queries。
- [~] Planner 输入目前通过 TypeScript 类型约束；尚未单独引入 Zod schema 校验 planner 输出。
- [ ] LLM Planner 尚未接入。

### Tools / Connectors

- [x] RedditSearchTool：通过现有 Reddit connector 接入。
- [x] EtsySearchTool：通过现有 Etsy connector 接入；无 key 时仍依赖既有 mock fallback。
- [x] X/Twitter hot-post source：通过 SoPilot RSS 接入，用于内容传播和 creator_outreach 问题。
- [~] Connector 失败时会记录 source progress error，其他来源继续执行。
- [ ] PinterestSearchTool 尚未实现。
- [ ] Google Trends / keyword tool 尚未实现。

### Evidence Bundle

- [x] 每个 bundle 绑定 `questionId`。
- [x] 每个来源最多保留 5 条 representative evidence。
- [x] 每条 representative evidence 保留 URL。
- [x] 每条 representative evidence 有 `metricSummary` 和 `whyItMatters`。
- [x] 没有证据的 question 不生成 Evidence Bundle。
- [~] 压缩摘要目前是规则拼接；后续可接 LLM compressor 提升质量。

### Opportunity / Report

- [x] Report 包含 runId、title、summary、topOpportunities、risks、nextSearchSuggestions。
- [x] Top Opportunity 保留 evidenceBundleIds、recommendedActions 和 sourceUrls。
- [x] 无 source URL 的机会会被过滤，避免无证据结论进入报告。
- [~] Opportunity score 复用现有单条 item scoring，并加 source coverage boost；尚未完整实现设计文档里的五因子加权评分。
- [ ] Report 尚未保存为数据库记录，也未生成 Output Asset。

### UI / API

- [x] 已新增 `POST /api/deepsearch` 和 `GET /api/deepsearch`。
- [x] 已新增 `/deepsearch` 页面，可输入目标和关键词运行 Agent。
- [x] 页面展示 Run State、Plan、Source Progress、Evidence Bundles、Report 和 Top Opportunities。
- [x] 首页导航已链接到 `/deepsearch`。
- [~] UI 是最小可用版本，还没有做 run 历史、失败重试、bundle detail 展开和导出。

### 本地自测结果

- [x] `npm run typecheck` 通过。
- [x] `npm run lint` 通过。
- [x] `npx prisma validate` 通过。
- [x] smoke test 通过：

```bash
ENRICHMENT_MODE=rules npx tsx -e "import { runDeepSearchAgent } from './src/modules/deepsearch/runner'; void (async () => { const result = await runDeepSearchAgent({ seedKeywords: ['ai tattoo'], limitPerSource: 1, lookbackDays: 7 }); console.log(JSON.stringify({ status: result.state.status, rawItems: result.state.rawItemCount, bundles: result.evidenceBundles.length, opportunities: result.report.topOpportunities.length, firstOpportunity: result.report.topOpportunities[0]?.title }, null, 2)); })();"
```

输出摘要：

```json
{
  "status": "completed",
  "rawItems": 13,
  "bundles": 6,
  "opportunities": 6,
  "firstOpportunity": "tattoo placement preview: 用户在纹身设计前最担心什么？"
}
```

### 下一步优先级

1. 把 DeepSearch Runner 的 run state、plan、question、bundle、report 写入 Prisma。
2. 给 `/deepsearch` 增加历史 run 列表和 run detail 页面。
3. 给 Planner/ReportWriter 增加 Zod schema 校验和 LLM provider 实现。
4. 实现真正的 Output Asset Generator：SEO brief、短视频脚本、Pinterest Prompt、KOC/KOL outreach。
5. 接 Pinterest 或 Google Trends，补齐视觉趋势和搜索需求信号。

