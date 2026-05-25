# PRD：数据库接入与持久化闭环

Status: ready-for-agent

## 1. 背景

Growth Automation Harness 的核心价值不是一次性生成内容，而是把增长研究过程沉淀成可追溯、可重放、可比较的数据链路。

当前仓库已经具备 Prisma/PostgreSQL schema，并且普通 MVP Workflow 已经能写入 `WorkflowConfig`、`WorkflowRun`、`RawItem`、`NormalizedItem`、`Enrichment`、`Opportunity` 和 `OutputAsset`。但产品层面仍有两个缺口：

1. 本地数据库还没有成为默认可用的运行基础设施。
2. DeepSearch 仍主要是一次请求内的内存结果，缺少 run state、plan、evidence 和 report 的持久化。

因此，本 PRD 的目标不是重新设计数据库，而是先把数据库接成可信运行记录层，让 Dashboard、Workflow、DeepSearch 和后续 Evidence Library 都能围绕同一套持久化数据工作。

## 2. 目标

- 本地开发环境可以稳定启动 PostgreSQL，并完成 Prisma migration。
- Dashboard 可以读取真实数据库状态，而不是主要依赖静态预览。
- 手动运行 MVP Workflow 后，能保留完整执行链路：配置、步骤、原始数据、归一化数据、增强、机会、资产。
- 修正 Raw Item 与 Workflow Run 的关系，避免重复运行时破坏历史 run 证据链。
- DeepSearch run 可以持久化，至少保存 query、vertical、depth、plan、questions、evidence bundles 和 final report。
- API 能按 run id 查询历史 Workflow Run 和 DeepSearch Run。
- 为后续 Run Detail、Evidence Library、Feedback Signal 留出稳定数据基础。

## 3. 非目标

- 不做多租户数据库隔离。
- 不做生产级数据库运维、备份和权限治理。
- 不做复杂 RBAC。
- 不做完整定时调度系统。
- 不在这一阶段接入所有外部数据源。
- 不做全自动发布或触达。
- 不把 DeepSearch 做成泛化搜索引擎。

## 4. 用户故事

### US-001：启动本地数据库

**Description:** 作为开发者，我想用一条标准流程启动 PostgreSQL 并运行 migration，以便本地环境能真实保存 workflow 数据。

**Acceptance Criteria:**

- [ ] `docker compose up -d` 可以启动 PostgreSQL。
- [ ] `.env` 中 `DATABASE_URL` 指向本地 `growth_harness` 数据库。
- [ ] `npm run db:migrate` 可以成功执行所有 migration。
- [ ] `npm run db:generate` 可以成功生成 Prisma Client。
- [ ] Dashboard 不再显示 PostgreSQL 不可达错误。

### US-002：保留 Workflow Run 历史

**Description:** 作为增长负责人，我想查看每次 workflow 的独立运行结果，以便比较不同运行之间的数据变化。

**Acceptance Criteria:**

- [ ] 每次点击 Run Workflow 都创建新的 `WorkflowRun`。
- [ ] `RunStep` 记录 extraction、normalization、enrichment/output 的状态、时间和计数。
- [ ] `WorkflowRun.summary` 记录 raw items、normalized items、opportunities、output assets 数量。
- [ ] `GET /api/workflow-runs` 返回最近运行记录和关联结果。
- [ ] Typecheck 通过。

### US-003：修正 Raw Item 与 Run 的关系

**Description:** 作为增长工程师，我想让 Raw Item 成为可复用的原始证据库，而不是被某一次 run 覆盖，以便后续规则变化时可以重放历史数据。

**Acceptance Criteria:**

- [ ] `RawItem` 继续按 `source + externalId` 去重。
- [ ] 新增 `WorkflowRunRawItem` 或等价关联表，记录某次 run 使用了哪些 Raw Item。
- [ ] 重复运行同一配置时，不会把旧 `RawItem.workflowRunId` 改到新 run 上。
- [ ] `NormalizedItem` 仍能关联到具体 `workflowRunId` 和 `rawItemId`。
- [ ] 增加测试覆盖重复运行不会破坏历史 run 的证据链。
- [ ] Typecheck 和相关测试通过。

### US-004：持久化 DeepSearch Run

**Description:** 作为运营，我想保存每一次 DeepSearch 的研究过程和报告，以便后续回看证据、复用机会和生成资产。

**Acceptance Criteria:**

- [ ] `DeepSearchRun` 保存 query、vertical、depth、seed keywords、status、current step。
- [ ] `DeepSearchPlan` 保存 goal、audience、expected outputs、context budget。
- [ ] `DeepSearchQuestion` 保存 question、intent、assigned agent、sources、queries 和 position。
- [ ] `EvidenceBundle` 保存 compressed summary、source evidence、confidence 和关联 question。
- [ ] `DeepSearchReport` 保存 executive summary、top opportunities、risks、next search suggestions 和 citations。
- [ ] `/api/deepsearch` 返回 `runId`。
- [ ] Typecheck 和 DeepSearch 测试通过。

### US-005：查询历史 DeepSearch Run

**Description:** 作为运营，我想打开历史 DeepSearch 结果，以便不用重新运行也能查看报告。

**Acceptance Criteria:**

- [ ] 新增 `GET /api/deepsearch-runs` 返回最近 DeepSearch runs。
- [ ] 新增 `GET /api/deepsearch-runs/[id]` 返回单个 run 的 plan、questions、evidence bundles 和 report。
- [ ] 找不到 run 时返回 404。
- [ ] 数据库不可用时返回可理解错误。
- [ ] Typecheck 通过。

### US-006：从 Opportunity 进入 DeepSearch

**Description:** 作为运营，我想从某个机会卡片继续做 DeepSearch，以便验证这个机会是否值得生成资产或执行。

**Acceptance Criteria:**

- [ ] Dashboard 的 Opportunity 卡片带有 DeepSearch 入口。
- [ ] DeepSearch URL 带入当前 product direction、keywords、opportunity title 和 evidence summary。
- [ ] DeepSearch 页面能从 URL 参数初始化 query、vertical、depth 和 keywords。
- [ ] 运行后保存 DeepSearch run。
- [ ] Verify in browser using dev-browser skill。

## 5. 功能需求

- FR-1：系统必须使用 PostgreSQL 作为本地 MVP 的持久化数据库。
- FR-2：系统必须通过 Prisma schema 和 migrations 管理数据库结构。
- FR-3：系统必须提供本地启动路径：`.env`、`docker compose up -d`、`npm run db:migrate`、`npm run dev`。
- FR-4：系统必须保留 `WorkflowConfig`、`WorkflowSource`、`WorkflowRun`、`RunStep`、`RawItem`、`NormalizedItem`、`Enrichment`、`Opportunity`、`OutputAsset`。
- FR-5：系统必须先保存 Raw Item，再执行 Normalization 和 Enrichment。
- FR-6：Raw Item 必须支持跨 run 去重，但 run 历史不能被去重逻辑覆盖。
- FR-7：系统必须能记录 Workflow Run 的失败步骤和错误信息。
- FR-8：DeepSearch 必须保存 run state，而不是只在前端页面 state 中存在。
- FR-9：DeepSearch 必须保存 research plan 和 questions，方便展示 agent timeline。
- FR-10：DeepSearch report 必须能通过 run id 重新读取。
- FR-11：API 必须在数据库不可用时返回明确错误，而不是让页面崩溃。
- FR-12：Dashboard 必须能读取数据库中最近的 Workflow Run 和生成资产。

## 6. 数据模型调整建议

### 6.1 保留现有模型

继续使用现有核心模型：

- `WorkflowConfig`
- `WorkflowSource`
- `WorkflowRun`
- `RunStep`
- `RawItem`
- `NormalizedItem`
- `Enrichment`
- `Opportunity`
- `OutputAsset`
- `DeepSearchRun`
- `DeepSearchPlan`
- `DeepSearchQuestion`
- `EvidenceBundle`
- `DeepSearchReport`

### 6.2 调整 Raw Item 归属

当前问题：

```prisma
model RawItem {
  workflowRunId String
  source        String
  externalId    String

  @@unique([source, externalId])
}
```

当同一个 `source + externalId` 在第二次 run 中被 upsert 时，旧 Raw Item 的 `workflowRunId` 会被更新到新 run。这样会破坏旧 run 的证据链。

建议改为：

```prisma
model RawItem {
  id         String   @id @default(cuid())
  source     String
  externalId String   @map("external_id")
  sourceUrl  String   @map("source_url")
  title      String
  payload    Json
  metrics    Json
  fetchedAt  DateTime @default(now()) @map("fetched_at")

  runLinks        WorkflowRunRawItem[]
  normalizedItems NormalizedItem[]

  @@unique([source, externalId])
  @@map("raw_items")
}

model WorkflowRunRawItem {
  id            String      @id @default(cuid())
  workflowRunId String      @map("workflow_run_id")
  rawItemId     String      @map("raw_item_id")
  position      Int?
  createdAt     DateTime    @default(now()) @map("created_at")

  workflowRun   WorkflowRun @relation(fields: [workflowRunId], references: [id], onDelete: Cascade)
  rawItem       RawItem     @relation(fields: [rawItemId], references: [id], onDelete: Cascade)

  @@unique([workflowRunId, rawItemId])
  @@map("workflow_run_raw_items")
}
```

### 6.3 补齐 DeepSearch 字段

建议给 `DeepSearchRun` 增加：

- `query String`
- `vertical String`
- `depth String`
- `evidenceCount Int`
- `findingCount Int`

建议给 `DeepSearchPlan` 增加：

- `vertical String`
- `depth String`
- `contextBudget Json`

建议给 `DeepSearchQuestion` 增加：

- `agent String`

建议给 `DeepSearchReport` 增加：

- `whatIsTrending String[]`
- `userPainPoints String[]`
- `recommendedActions String[]`
- `citations Json`

## 7. API 设计

### 7.1 Workflow APIs

现有：

- `GET /api/workflow-runs`
- `POST /api/workflow-runs`

建议新增：

- `GET /api/workflow-runs/[id]`

返回内容：

- run metadata
- config summary
- steps
- raw item count
- normalized item count
- opportunities
- output assets
- error if failed

### 7.2 DeepSearch APIs

调整现有：

- `POST /api/deepsearch`

新增：

- `GET /api/deepsearch-runs`
- `GET /api/deepsearch-runs/[id]`

`POST /api/deepsearch` 返回示例：

```json
{
  "runId": "deepsearch_run_id",
  "result": {
    "state": {},
    "plan": {},
    "evidenceBundles": [],
    "report": {}
  }
}
```

## 8. 实施顺序

### Phase 1：本地数据库跑通

1. 确认 `.env` 的 `DATABASE_URL`。
2. 启动 PostgreSQL：`docker compose up -d`。
3. 执行 migration：`npm run db:migrate`。
4. 生成 Prisma Client：`npm run db:generate`。
5. 打开 Dashboard，确认数据库可达。
6. 点击 Run Workflow，确认至少生成一条 `WorkflowRun`。

### Phase 2：修正 Raw Item 证据链

1. 修改 Prisma schema，新增 run 与 raw item 的关联表。
2. 生成 migration。
3. 修改 `runMvpWorkflow` 的 extraction 保存逻辑。
4. 增加重复运行测试。
5. 验证旧 run 不会被新 run 覆盖。

### Phase 3：DeepSearch 持久化

1. 新增 DeepSearch persistence adapter。
2. `runDeepSearchAgent` 开始时创建 `DeepSearchRun`。
3. planner 完成后保存 `DeepSearchPlan` 和 `DeepSearchQuestion`。
4. evidence extraction 完成后保存 `EvidenceBundle`。
5. synthesis 完成后保存 `DeepSearchReport`。
6. 失败时更新 run status 和 error。

### Phase 4：历史查询和 UI 接入

1. 新增 Workflow Run Detail API。
2. 新增 DeepSearch Run list/detail API。
3. Dashboard 展示最近 Workflow Run 和 DeepSearch Run。
4. DeepSearch 页面支持从历史 run id 读取结果。

## 9. 测试策略

- 数据库 migration 测试：迁移可以在空库上成功执行。
- Workflow Run 测试：点击运行后，步骤顺序和结果计数正确。
- Raw Item 去重测试：重复运行同一配置，不重复插入 Raw Item，也不破坏历史 run 关联。
- DeepSearch 持久化测试：运行后可以从数据库重新读取 plan、bundles 和 report。
- API 测试：数据库不可达时返回明确错误。
- UI 回归：Dashboard、Opportunity 卡片、DeepSearch 入口和历史详情页在浏览器中可用。

## 10. 成功指标

- 本地新环境 5 分钟内可以完成数据库启动和 migration。
- `Run Workflow` 后至少生成：
  - 1 个 `WorkflowRun`
  - 2 个 `RunStep`
  - 5 个 `RawItem`
  - 5 个 `NormalizedItem`
  - 3 个 `Opportunity`
  - 1 个 `OutputAsset`
- 连续运行两次 workflow 后，旧 run 的 evidence 链路仍可追溯。
- `POST /api/deepsearch` 后可以通过 run id 重新读取完整报告。
- Dashboard 不再依赖硬编码预览来解释主流程。

## 11. 风险与注意事项

- Raw Item 关系调整会影响现有 migration，需要确认是否保留旧库数据。如果只是本地 MVP，可以直接迁移；如果已有重要数据，要写数据迁移脚本。
- DeepSearch 的当前类型结构比 Prisma schema 更丰富，持久化时要避免把所有字段压进不可查询的大 JSON。
- 真实 Connector 可能受网络、限流和 API key 影响，数据库接入阶段应保留 mock/hybrid fallback。
- 不要在数据库接入阶段引入队列和异步 worker，除非同步 workflow 已经稳定。

## 12. 开放问题

- 是否允许在本地 MVP 阶段重置数据库，还是需要兼容已有数据？
- DeepSearch report 是否需要单独支持 Markdown 导出，还是先只保存结构化 JSON？
- `FeedbackSignal` 是否在本阶段建表，还是等 Output Asset 审核/导出稳定后再做？
- Workflow Run Detail 是否先做 API，还是同步做页面？
