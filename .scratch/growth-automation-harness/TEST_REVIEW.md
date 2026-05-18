# 测试评审文档：Growth Automation Harness

## 测试策略

- 测试外部行为，不测试私有实现细节。
- Connector 测试要验证源响应能转换成 Raw Item，并验证字段缺失或限流时能以可预期方式失败。
- Normalization 测试要验证 Raw Item 到 Normalized Item 的稳定转换，包括去重、语言处理、指标标准化和 URL 保留。
- Enrichment 测试要验证 schema 解析、必填字段、分数范围，以及 AI 返回异常格式时的兜底行为。
- Workflow Config 测试要验证过滤条件、Prompt 版本、输出模板和调度配置会被正确解释。
- Workflow Run 测试要验证步骤顺序、失败记录、重试边界和生成资产引用。
- Opportunity scoring 测试要使用接近真实来源模式的 fixture，例如高互动帖子、重复商品、低信号评论和创作者主页。
- UI 测试聚焦运营路径：创建工作流、运行工作流、审核机会、查看来源证据、导出结果。

## 数据采集测试

| ID | 用例 | 输入 | 预期 |
| --- | --- | --- | --- |
| TC-COL-001 | Reddit 正常扫描 | subreddit: `tattoo`, keyword: `ai tattoo` | 返回帖子列表并保存 Raw Item。 |
| TC-COL-002 | Pinterest/Etsy 正常扫描 | keyword: `fine line tattoo` | 返回视觉或商品趋势数据并保存 Raw Item。 |
| TC-COL-003 | 重复扫描 | 连续运行同一配置两次 | 不重复插入相同 external id、URL 或内容 hash。 |
| TC-COL-004 | 空关键词 | keyword 为空 | 返回校验错误，UI 显示错误状态。 |
| TC-COL-005 | 无结果关键词 | 随机乱码关键词 | 页面显示 empty state，不崩溃。 |
| TC-COL-006 | API 失败 | 模拟 Reddit 或 Etsy/Pinterest 失败 | Workflow Run 记录 failed step 和错误信息。 |
| TC-COL-007 | 字段缺失 | 来源缺少 author 或 metrics | Raw Item 仍保存，缺失字段为 null 或默认值。 |

## 清洗和标准化测试

| ID | 用例 | 输入 | 预期 |
| --- | --- | --- | --- |
| TC-NOR-001 | 标题空格清洗 | ` AI   tattoo   ideas ` | 标题被清洗成正常文本。 |
| TC-NOR-002 | URL 保留 | Raw Item 含 source URL | Normalized Item 保留 source URL。 |
| TC-NOR-003 | URL 去重 | 同一 URL 带不同 tracking 参数 | 归一化后只保留一条。 |
| TC-NOR-004 | 指标标准化 | Reddit upvotes、Etsy favorites、Pinterest saves | 转换成 normalized engagement score。 |
| TC-NOR-005 | 语言处理 | 英文、中文、混合文本 | language 字段可识别或标记 unknown。 |
| TC-NOR-006 | 媒体字段 | 来源含图片 URL | media URLs 被保留。 |
| TC-NOR-007 | 低质量数据 | 内容过短且无互动 | 被标记为 low signal 或低分。 |

## AI Enrichment 测试

| ID | 用例 | 输入 | 预期 |
| --- | --- | --- | --- |
| TC-ENR-001 | 高质量输入 | 有标题、正文、指标、URL | 输出 pain points、intent、trend type、keywords、content angles、evidence summary 和 opportunity score。 |
| TC-ENR-002 | 信息不足 | 只有短标题 | 输出低置信度、风险或较低机会分。 |
| TC-ENR-003 | 非相关内容 | 与 AI tattoo 无关 | opportunity score 低，reason 说明不匹配。 |
| TC-ENR-004 | 模型返回坏 JSON | mock invalid JSON | 系统重试或记录 recoverable error。 |
| TC-ENR-005 | 分数边界 | AI 返回大于 100 或小于 0 | schema 校验失败或 clamp 到合法范围。 |
| TC-ENR-006 | Prompt 版本 | 使用不同 Prompt 版本 | Enrichment 记录 prompt version。 |

## Opportunity 和 Output Asset 测试

| ID | 用例 | 操作 | 预期 |
| --- | --- | --- | --- |
| TC-OPP-001 | 聚合机会 | 多条 Normalized Item 指向同一趋势 | 合并成一个 Opportunity，并保留 evidence 引用。 |
| TC-OPP-002 | 机会排序 | 多个机会分数不同 | 高分机会排在前面。 |
| TC-AST-001 | 生成 SEO brief | 点击生成 SEO brief | 输出标题、搜索意图、页面结构、证据来源。 |
| TC-AST-002 | 生成短视频选题 | 点击生成 short video idea | 输出 hook、脚本方向、目标受众、来源证据。 |
| TC-AST-003 | 生成素材 Prompt | 点击生成 image prompt asset | 输出适合 AI tattoo generator 的 Prompt 模板。 |
| TC-AST-004 | 生成触达草稿 | 点击生成 outreach draft | 输出基于来源上下文的个性化触达话术。 |
| TC-AST-005 | 导出 Markdown | 点击导出 | Markdown 包含 opportunity、asset 和 source URL。 |
| TC-AST-006 | 导出 CSV | 点击导出 | CSV 字段完整且可被表格打开。 |

## Workflow Config 和 Workflow Run 测试

| ID | 用例 | 操作 | 预期 |
| --- | --- | --- | --- |
| TC-WF-001 | 创建工作流 | 设置产品方向、关键词、来源和过滤器 | Workflow Config 保存成功。 |
| TC-WF-002 | 手动运行 | 点击 Run Workflow | 按 Extraction -> Normalization -> Enrichment -> Output 顺序执行。 |
| TC-WF-003 | 过滤低互动 | 设置最低互动量 | 低于阈值的 item 不进入 enrichment。 |
| TC-WF-004 | 失败记录 | Connector 失败 | Workflow Run 记录失败步骤、错误和计数。 |
| TC-WF-005 | 重试边界 | 对失败步骤重试 | 不重复创建已成功的下游结果。 |
| TC-WF-006 | Review gate | 生成触达或发布类资产 | 默认需要人工审核，不自动发送。 |
| TC-WF-007 | Feedback Signal | 手动录入 views/clicks/leads | 指标关联到 Output Asset 或 Opportunity。 |

## DeepSearch 测试

| ID | 用例 | 输入 | 预期 |
| --- | --- | --- | --- |
| TC-DS-001 | AI tattoo 垂类识别 | `Find growth opportunities for AI tattoo generator` | Router 选择 `ai_tattoo_generator`。 |
| TC-DS-002 | AI SaaS 垂类识别 | `Find growth opportunities around AI workflow tools` | Router 选择 `ai_saas`。 |
| TC-DS-003 | 手动垂类覆盖 | 用户手动选择 `ai_tattoo_generator` | 系统尊重手动选择。 |
| TC-DS-004 | 研究计划生成 | AI tattoo query | Planner 生成 Reddit pain points、visual trends、SEO topics 等任务。 |
| TC-DS-005 | Reddit 子 Agent | pain point task | 返回 finding、evidence、gap 和 confidence。 |
| TC-DS-006 | SEO 子 Agent | SEO topic task | 返回关键词机会和页面 brief 方向。 |
| TC-DS-007 | 子 Agent 失败 | 模拟一个来源失败 | DeepSearch 继续运行，并生成 partial report。 |
| TC-DS-008 | 上下文预算 | 子 Agent 返回 100 条 raw item | 系统只保留 top raw items 和 top evidence 进入 synthesis。 |
| TC-DS-009 | Evidence 合并 | 多条证据支持同一 claim | 合并到同一个 claim 下。 |
| TC-DS-010 | 报告引用 | 生成最终报告 | 关键结论带 source URL 或明确标记为 inference。 |
| TC-DS-011 | 报告转任务 | 点击 create tasks | Opportunity 转成 Output Asset 或 Workflow Task。 |

## UI 演示回归测试

| ID | 用例 | 操作 | 预期 |
| --- | --- | --- | --- |
| TC-UI-001 | 首页加载 | 打开应用 | 能看到增长工作流入口和当前 demo 垂类。 |
| TC-UI-002 | 运行状态 | 运行 workflow | UI 显示 loading、step status 和结果计数。 |
| TC-UI-003 | 证据回看 | 点击 opportunity evidence | 能打开来源 URL 或查看 source metadata。 |
| TC-UI-004 | 空状态 | 没有机会结果 | UI 提示调整关键词、来源或时间范围。 |
| TC-UI-005 | 错误状态 | 模拟 API 失败 | UI 显示可理解错误，不丢失已完成步骤。 |
| TC-UI-006 | 移动端查看 | 小屏打开核心页面 | 表格和卡片不重叠，主要操作可用。 |

## Demo 前检查清单

- [ ] 可以创建或读取默认 AI tattoo generator Workflow Config。
- [ ] 可以手动运行一次 workflow。
- [ ] 至少生成 10 条 Raw Item fixture 或真实来源数据。
- [ ] 至少生成 5 条 Normalized Item。
- [ ] 至少生成 3 张 Opportunity Card。
- [ ] 至少生成 1 个 SEO brief、1 个短视频选题、1 个素材 Prompt。
- [ ] 每条核心洞察都有 source URL。
- [ ] DeepSearch 可以从一个 query 生成 research plan。
- [ ] DeepSearch 报告可以展示 evidence 和 recommended actions。
- [ ] 导出 Markdown 或 CSV 可用。
- [ ] 错误、空状态、加载状态都可见。
