# UI 文档：Growth Automation Harness

## UI 原则

- 第一屏进入实际工作台，不做营销 landing page。
- 页面围绕运营工作流组织，而不是围绕技术模块组织。
- 每条结论必须能点回证据来源。
- 表格、看板、详情页要适合重复操作和快速扫描。
- 页面要体现完整闭环：配置、运行、审核、生成、导出、反馈。

## 信息架构

```txt
Dashboard
Workflow Configs
Run Detail
Opportunity Inbox
Output Assets
DeepSearch
Evidence Library
Feedback
Settings
```

## 核心页面

### Dashboard

用途：展示当前增长系统的总体状态。

模块：

- 当前 demo 垂类：AI tattoo generator
- 最近 Workflow Runs
- 新增 Raw Items
- 高分 Opportunities
- 已生成 Output Assets
- 待审核内容
- Feedback Signal 摘要

### Workflow Configs

用途：配置增长扫描工作流。

字段：

- Product direction
- Keywords
- Sources
- Filters
- Prompt version
- Output templates
- Schedule
- Destinations

关键操作：

- Create workflow
- Edit workflow
- Run manually
- Enable schedule
- Duplicate workflow

### Run Detail

用途：查看一次 workflow 的执行过程和结果。

模块：

- Step timeline
- Extraction result count
- Normalization result count
- Enrichment status
- Generated opportunities
- Generated output assets
- Error logs

状态：

```txt
pending -> extracting -> normalizing -> enriching -> generating -> completed
failed
partial_success
```

### Opportunity Inbox

用途：让运营审核和排序增长机会。

表格字段：

- Opportunity title
- Score
- Trend type
- Source count
- Evidence count
- Suggested asset type
- Status
- Created time

筛选：

- Source
- Score range
- Trend type
- Status
- Keyword

操作：

- View evidence
- Accept
- Reject
- Generate SEO brief
- Generate short video idea
- Generate prompt asset
- Export

### Output Assets

用途：管理系统生成的可执行资产。

资产类型：

- SEO brief
- Short video idea
- Image prompt asset
- KOC/KOL list
- Outreach draft
- Markdown report
- CSV export

状态：

```txt
draft -> review_required -> approved -> exported -> feedback_recorded
```

### DeepSearch

用途：主动研究复杂增长问题。

输入区：

- Query input
- Vertical selector
- Source selector
- Depth selector
- Run button

运行区：

- Research Plan
- Agent Activity Timeline
- Subagent Status
- Evidence Board
- Opportunity Cards
- Final Report
- Create Workflow Tasks

深度选项：

| 模式 | 说明 |
| --- | --- |
| Quick Scan | 1 轮搜索，快速判断方向 |
| Standard Research | 2 轮以内，包含证据提取 |
| Deep Research | 允许 gap-filling 搜索，但最多 2 层 |

### Evidence Library

用途：集中查看所有支持机会判断的证据。

字段：

- Claim
- Source
- URL
- Snippet
- Metrics
- Confidence
- Related opportunity
- Related run

### Feedback

用途：记录后续效果。

字段：

- Opportunity
- Output Asset
- Publish URL
- Views
- Clicks
- Leads
- Notes
- Review summary

## 关键用户路径

### 普通工作流路径

```txt
Create Workflow
  -> Run Manually
  -> View Run Detail
  -> Review Opportunities
  -> Generate Output Asset
  -> Export
  -> Record Feedback
```

### DeepSearch 路径

```txt
Enter Query
  -> Select Vertical / Depth
  -> Run DeepSearch
  -> Watch Agent Timeline
  -> Review Evidence
  -> Read Report
  -> Create Output Assets
```

## UI 状态要求

- Loading：运行中展示 step-level progress。
- Empty：告诉用户可以调整关键词、来源或时间范围。
- Error：保留已完成步骤，不要整页丢失。
- Partial success：明确哪些 source 或 agent 失败。
- Review required：发布和触达类资产默认需要人工确认。

## 移动端要求

- 核心页面不能出现文字重叠。
- 表格在移动端切换成卡片列表。
- 主要操作按钮固定在详情页底部或卡片内。
- DeepSearch report 在移动端先显示 summary，再折叠 evidence。

## Demo 路径

推荐 5 分钟演示：

1. 打开 Dashboard，说明垂类是 AI tattoo generator。
2. 进入 Workflow Config，展示关键词和来源配置。
3. 点击 Run Manually。
4. 进入 Run Detail，看 step timeline 和结果计数。
5. 进入 Opportunity Inbox，打开高分机会。
6. 查看 evidence URL 和 AI enrichment。
7. 生成 SEO brief 或短视频选题。
8. 导出 Markdown 或 CSV。
9. 打开 DeepSearch，输入一个主动研究问题，展示 agent plan 和 report。
