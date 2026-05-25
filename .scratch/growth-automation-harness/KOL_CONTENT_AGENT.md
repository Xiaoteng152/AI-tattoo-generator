# PRD：KOL 内容增长 Agent

Status: draft

## 1. 定位

KOL 内容增长 Agent 是 DeepSearch 的内容生产分支。它面向的人设是：

> 专门拆解 AI 产品的流量机会和增长打法。

它不是泛资讯摘要工具，也不是一次性写作 Prompt。它要把 **AI 产品案例、市场信号、用户痛点、增长打法和可传播观点** 组织成一个可中断、可恢复、可人工选择的内容生产工作流，最终输出爆款中文长推、文章草稿或可复用观点素材库。

第一版推荐使用 **LangGraph** 编排。LangGraph 负责长流程状态机、checkpoint、interrupt、人机选择和 resume；现有 DeepSearch 模块继续负责垂类识别、研究计划、source agent、evidence extraction 和 synthesis。

## 2. 目标

- 让用户输入一个 AI 产品、产品链接、观察到的现象或宽泛话题后，系统生成可选择的爆款内容方向。
- 在关键节点暂停，让用户选择方向、素材、观点和成稿偏好。
- 保存每个断点状态，允许用户刷新页面或稍后继续。
- 输出一套组合包：
  - 爆款方向候选
  - 素材卡
  - 观点卡
  - 标题候选
  - 开头钩子
  - 中文长推 / thread 或文章草稿
  - 可复用素材库
- 帮助用户建立 KOL 人设：AI 产品增长机会拆解者。

## 3. 非目标

- 第一版不做全自动发布。
- 第一版不接满所有搜索 API。
- 第一版不做通用写作工具。
- 第一版不做多账号内容矩阵。
- 第一版不让模型绕过人工确认直接发布。
- 第一版不追求完全自动判断“爆款”，而是给出可解释评分和人工选择。

## 4. 核心输入

用户可以输入：

- AI 产品名。
- 产品官网、Product Hunt、GitHub、X thread、YouTube、Reddit 或竞品链接。
- 自己观察到的现象。
- 目标受众。
- 想输出的内容类型：长推、文章、素材库或组合包。
- 补充素材：截图文字、产品功能点、运营数据、用户反馈、个人经历。

第一版数据来源优先级：

1. 用户手动输入的产品和素材。
2. 现有 Connector：Reddit、X/Twitter、Etsy 或项目已有 mock/hybrid 数据。
3. DeepSearch fixture / 已有 evidence。
4. 后续可选接入 Web Search、Tavily、SerpAPI、YouTube、TikTok、Product Hunt。

## 5. Search 能力路线图

Search 是 KOL 内容增长 Agent 的证据采集层。它不直接写文章，而是为 `direction_candidates`、`material_board` 和 `opinion_mining` 提供可追溯素材。

Search 的核心原则：

- 先证明人机断点和成文闭环，再扩展数据源。
- 每条素材必须保留来源、URL、snippet、指标和置信度。
- Search 结果要按内容生产需要归类，而不是只按网页相关性排序。
- Search 失败不能阻断整个 run；允许进入 partial material board。
- 不把未经验证的模型判断伪装成事实。

### 5.1 Search MVP：手动输入 + 现有 Connector

目标：最快跑通“输入产品案例 -> 生成方向 -> 用户选择 -> 生成素材/观点/长推”的闭环。

数据源：

- 用户输入的产品名、链接、截图文字和观察。
- 现有 Reddit Connector。
- 现有 X/Twitter Connector 或 SoPilot hot tweets RSS。
- 现有 Etsy/mock 数据。
- DeepSearch fixture。

能力：

- 将用户输入拆成产品、受众、增长现象、可写角度。
- 根据产品案例生成 3 到 7 个搜索问题。
- 调用现有 Connector 获取少量信号。
- 将结果归一化为 Material Card。
- 生成方向候选并触发 `human_select_direction`。

不做：

- 不接新搜索 API。
- 不做全网搜索。
- 不做自动抓取 Product Hunt、YouTube、TikTok。
- 不做长期趋势库。

验收标准：

- 用户只输入一个 AI 产品名和一句观察，也能得到至少 3 个方向候选。
- 每个方向至少有 1 条素材或明确标记为“证据不足”。
- 用户选择方向后可以继续生成长推草稿。
- 刷新后可以从方向选择断点恢复。

### 5.2 Search V1：产品案例搜索

目标：让 Agent 能主动补齐 AI 产品案例，不完全依赖用户手动输入。

新增数据源：

- Web Search API：Tavily、SerpAPI 或同类服务二选一。
- Product Hunt 搜索或手动 URL 解析。
- 官网页面摘要。
- GitHub repository metadata，适用于开源 AI 产品。

能力：

- 根据产品名搜索官网、定价页、更新日志、Product Hunt 页面、竞品页面。
- 识别产品定位、目标用户、核心功能、增长动作和分发渠道。
- 生成 Product Case Profile：
  - `product_name`
  - `category`
  - `target_user`
  - `core_promise`
  - `growth_motion`
  - `distribution_channels`
  - `pricing_or_offer`
  - `notable_claims`
- 将产品案例转成素材卡和方向候选。

断点：

- `human_select_direction` 前显示“产品案例理解结果”。
- 用户可以修正产品定位、目标用户和不想写的角度。

验收标准：

- 输入一个产品名或官网 URL 后，能产出 Product Case Profile。
- 方向候选能明确引用产品案例信息，而不是泛泛谈 AI。
- 至少 70% 素材卡有 URL。
- Search API 失败时，用户仍可用手动输入继续。

### 5.3 Search V2：社交信号与内容模式搜索

目标：把产品案例和真实传播信号连接起来，提升“爆款方向”判断质量。

新增数据源：

- Reddit 深度搜索：帖子 + 评论痛点。
- X/Twitter：热帖、创作者表达、转发评论模式。
- YouTube：标题、描述、评论需求。
- TikTok：第一版可先用手动链接或第三方搜索摘要。
- SEO/SERP：关键词意图、People Also Ask、竞品文章。

能力：

- 将产品案例扩展成多组搜索 query：
  - pain query
  - comparison query
  - alternative query
  - use-case query
  - trend query
  - controversy query
- 抽取内容模式：
  - 高互动标题结构
  - 评论区反复出现的问题
  - 争议点
  - 用户自发表达
  - 可复用开头钩子
- 建立 Viral Direction Score：
  - trend momentum
  - audience pain intensity
  - novelty
  - conflict
  - proof strength
  - business relevance

断点：

- `human_select_materials` 前展示素材板，按“用户痛点 / 产品案例 / 热点表达 / SEO 意图 / 反常识观点”分组。
- 用户选择素材后，系统只基于已选素材进入观点提炼。

验收标准：

- 每个高分方向至少有 3 类素材支撑。
- 素材板能清楚区分事实证据和模型推断。
- 能生成至少 5 个观点卡，并标注传播风险。
- DeepSearch 结果可转入 Content Agent。

### 5.4 Search V3：持续选题雷达与反馈学习

目标：从单次搜索升级为持续发现选题机会，服务长期 KOL 增长。

新增能力：

- Topic Watchlist：持续监控 AI 产品、竞品、关键词、创作者和社区。
- Long-term Memory：保存用户采纳过的方向、发布过的内容和偏好。
- Feedback Signal：记录曝光、收藏、评论、转发、关注增长。
- Opportunity Replay：同一主题隔一段时间重新搜索，比较信号变化。
- Content Calendar：将高分方向排入待写列表。

能力：

- 自动发现“最近值得写”的 AI 产品增长话题。
- 根据历史发布效果调整评分权重。
- 避免重复写相同角度。
- 为用户生成每周选题池。

断点：

- 每周推荐前进入 `human_select_direction`。
- 用户可以标记“写过了 / 不适合我的人设 / 值得深挖 / 转成长文”。

验收标准：

- 系统能按周生成 10 个候选选题。
- 每个选题有历史变化说明。
- 用户发布反馈能回流到下次评分。
- 能形成“选题 -> 成稿 -> 发布反馈 -> 下次推荐”的闭环。

## 6. 输出结构

### 6.1 爆款方向候选

每个方向包含：

- 标题级描述。
- 核心判断。
- 流量钩子。
- 目标受众。
- 支撑证据摘要。
- 风险或反例。
- 推荐内容形态。
- 综合评分。

评分模型：

```txt
流量潜力 40%
专业可信 30%
商业价值 30%
```

### 6.2 素材卡

素材卡类型：

- 产品案例。
- 用户痛点。
- 增长动作。
- 渠道打法。
- 竞品对比。
- 反常识观察。
- 数据或指标。
- 可引用表达。

每张素材卡必须包含：

- `claim`
- `why_it_matters`
- `source`
- `url`
- `snippet`
- `usable_angle`
- `confidence`

### 6.3 观点卡

观点卡包含：

- 一句话观点。
- 支撑证据。
- 适合的开头钩子。
- 可展开段落。
- 传播风险。
- 适合人设程度。

### 6.4 成稿

第一版成稿以中文长推 / thread 为主，也支持文章草稿。

默认风格：

```txt
70% 增长操盘手
20% 技术观察者
10% 犀利评论
```

长推结构：

```txt
1. 强钩子：一句话指出产品增长机会或反常识判断
2. 案例：这个 AI 产品做了什么
3. 信号：为什么现在值得关注
4. 拆解：流量来源、用户痛点、转化路径
5. 方法论：其他 AI 产品可以复用什么
6. 结论：一个可收藏的增长判断
7. 互动钩子：引导评论、收藏或关注
```

## 7. LangGraph 工作流

### 7.1 Graph 节点

```txt
intake
  -> case_expansion
  -> signal_collection
  -> direction_candidates
  -> human_select_direction
  -> material_board
  -> human_select_materials
  -> opinion_mining
  -> human_select_opinion
  -> draft_generation
  -> human_review_draft
  -> final_pack
```

### 7.2 节点职责

#### intake

- 读取用户输入。
- 识别人设、主题、目标受众和输出类型。
- 标准化为 `ContentAgentInput`。

#### case_expansion

- 提取 AI 产品案例。
- 梳理产品功能、目标用户、增长动作和可写角度。
- 如果素材不足，生成需要用户补充的问题。

#### signal_collection

- 调用现有 DeepSearch / Connector 能力。
- 收集 Reddit、X/Twitter、SEO、YouTube/TikTok fixture 或用户输入证据。
- 输出结构化 signal。

#### direction_candidates

- 生成 3 到 7 个爆款方向候选。
- 用综合评分排序。
- 解释每个方向为什么可能传播。

#### human_select_direction

LangGraph interrupt 节点。

用户操作：

- 选择一个或多个方向。
- 可补充个人立场、经历或不要写的角度。

#### material_board

- 根据用户选中的方向整理素材卡。
- 去重、压缩、分组。
- 标记高可信和高传播素材。

#### human_select_materials

LangGraph interrupt 节点。

用户操作：

- 选择要采用的素材卡。
- 删除不想用的素材。
- 添加自己的补充素材。

#### opinion_mining

- 从素材中提炼观点卡。
- 生成冲突感、结果感、身份感、场景感和悬念感角度。
- 给出每个观点的传播风险。

#### human_select_opinion

LangGraph interrupt 节点。

用户操作：

- 选择主观点。
- 选择备选观点。
- 调整语气强度。

#### draft_generation

- 生成标题、开头钩子、正文草稿和结尾转化钩子。
- 默认输出中文长推 / thread。
- 需要保留证据索引，避免成稿变成无来源判断。

#### human_review_draft

LangGraph interrupt 节点。

用户操作：

- 接受。
- 要求重写。
- 调整风格。
- 指定删改段落。

#### final_pack

输出最终包：

- 成稿。
- 备用标题。
- 备用开头。
- 素材库。
- 证据列表。
- 后续选题建议。

## 8. Graph State

建议状态：

```ts
type ContentAgentState = {
  runId: string;
  status:
    | "intake"
    | "researching"
    | "waiting_for_direction"
    | "waiting_for_materials"
    | "waiting_for_opinion"
    | "waiting_for_draft_review"
    | "completed"
    | "failed";
  persona: "ai_product_growth_analyst";
  input: ContentAgentInput;
  caseProfile?: ProductCaseProfile;
  signals: GrowthSignal[];
  directionCandidates: DirectionCandidate[];
  selectedDirectionIds: string[];
  materials: MaterialCard[];
  selectedMaterialIds: string[];
  opinions: OpinionCard[];
  selectedOpinionId?: string;
  draft?: ContentDraft;
  finalPack?: ContentFinalPack;
  userNotes: UserNote[];
  checkpoints: ContentCheckpoint[];
  error?: string;
};
```

## 9. 数据模型建议

第一版可以先用 JSON 字段降低迁移成本，但要保留可查询的核心字段。

```prisma
model ContentAgentRun {
  id           String   @id @default(cuid())
  userId       String?
  status       String
  persona      String
  topic        String
  productName  String?
  outputType   String
  currentNode  String
  selectedDirectionIds String[]
  selectedMaterialIds  String[]
  selectedOpinionId    String?
  state        Json
  finalContent String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model ContentAgentCheckpoint {
  id        String   @id @default(cuid())
  runId     String
  node      String
  status    String
  payload   Json
  createdAt DateTime @default(now())
}
```

后续再拆分：

- `ContentDirectionCandidate`
- `ContentMaterial`
- `ContentOpinion`
- `ContentDraft`

## 10. UI 交互

第一版放在 DeepSearch 页面内增加一个模式：

```txt
DeepSearch
  - Growth Research
  - KOL Content Agent
```

交互形态：

- 左侧：用户输入、当前 run 状态、阶段 timeline。
- 中间：候选方向 / 素材卡 / 观点卡 / 草稿。
- 右侧：证据、评分解释、用户补充输入框。

每个 interrupt 节点 UI：

- 展示候选卡片。
- 支持单选或多选。
- 支持自由补充。
- 提交后调用 resume API。

## 11. API 设计

```txt
POST /api/content-agent/runs
创建 run，启动到第一个 interrupt 或完成。

GET /api/content-agent/runs
查看历史 run。

GET /api/content-agent/runs/[id]
读取当前 state、候选项、草稿和 final pack。

POST /api/content-agent/runs/[id]/resume
提交用户选择和补充说明，继续 LangGraph。
```

请求示例：

```json
{
  "topic": "一个 AI 视频剪辑产品为什么适合做 PLG 增长",
  "productName": "Example AI Video Tool",
  "productUrl": "https://example.com",
  "audience": "AI 产品创业者和增长从业者",
  "outputType": "combo_pack",
  "notes": "希望角度更偏增长打法，不要写成产品测评"
}
```

## 12. 错误与恢复

- 每个 LangGraph checkpoint 必须落库。
- API 超时前必须返回当前 run id。
- 如果某个 source agent 失败，run 进入 partial 状态，不丢弃已采集素材。
- 用户可以从历史 run 继续未完成节点。
- 如果 LLM 输出不符合 schema，进入修复节点或返回可理解错误。
- 所有可发布内容必须经过 `human_review_draft`。

## 13. 实施阶段

### Phase 1：手动输入 + LangGraph 断点 MVP

- 引入 LangGraph。
- 建 `ContentAgentRun` 和 checkpoint。
- 实现 intake、direction candidates、human select direction、draft generation、final pack。
- 数据源先用用户输入 + 现有 DeepSearch mock/connector 结果。

### Phase 2：素材库与观点卡

- 实现 material board。
- 实现 opinion mining。
- 增加素材选择和观点选择 interrupt。
- 输出组合包。

### Phase 3：接入 DeepSearch 证据链

- 复用现有 DeepSearch runner 或子模块作为 signal collection node。
- 将 evidence bundles 转成 material cards。
- 支持从 Opportunity Card 进入 Content Agent。

### Phase 4：可选外部搜索

- 接入 Web Search / Tavily / SerpAPI。
- 增加 Product Hunt / YouTube / TikTok / SEO 数据源。
- 增加 source-level rate limit 和成本控制。

### Phase 5：内容反馈闭环

- 用户记录发布链接、曝光、收藏、评论。
- 形成 Feedback Signal。
- 回流到方向评分和选题偏好。

## 14. 验收标准

- 用户输入一个 AI 产品案例后，系统能生成至少 3 个爆款方向候选。
- 系统在方向选择节点暂停，刷新后仍能恢复。
- 用户选择方向后，系统能生成素材卡和观点卡。
- 用户选择观点后，系统能生成中文长推草稿。
- 最终输出包含成稿、备用标题、素材库和证据列表。
- 所有成稿都经过人工确认节点。
- 失败时保留 run id 和已完成 checkpoint。
