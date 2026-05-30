# Automnic TT Agent 指南

这个仓库正在被规划为一个 Growth Automation Harness：一个面向海外 C 端产品增长的自动化平台，用来发现增长机会、提取和清洗多渠道数据、生成运营可用资产，并追踪执行结果。

## Agent skills

### Issue tracker

本仓库的 PRD 和任务使用本地 Markdown 管理，路径在 `.scratch/`。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用 mattpocock/skills 默认的任务状态词：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs

这是一个单上下文项目。做产品或架构工作前，先读 `CONTEXT.md`；如果后续新增了 ADR，再检查 `docs/adr/`。详见 `docs/agents/domain.md`。

## 产品方向

构建一个面向海外 C 端产品的增长自动化平台。平台要帮助运营从手动找热点，升级为可配置、可重复执行的增长工作流：

1. 配置产品方向、关键词、数据源、过滤条件、Prompt 和输出模板。
2. 从 Reddit、TikTok、YouTube、Etsy、Pinterest、Google Trends、关键词工具等渠道提取原始数据。
3. 对数据做归一化、去重、清洗、评分和 AI 增强。
4. 用 LLM 工作流识别用户痛点、趋势、内容角度、SEO 机会和 KOC/KOL 触达目标。
5. 生成可供运营审核的输出，例如 SEO brief、社媒内容草稿、素材 Prompt、KOC/KOL 列表和触达话术。
6. 追踪执行结果，并把效果数据回流到后续机会评分里。

MVP 要保持窄范围：Reddit 加一个视觉或电商数据源、AI 增强、机会排序、工作流配置界面，以及 Markdown 或 CSV 导出。

## 可用 Superpowers

已安装的 mattpocock skills 建议这样使用：

- `to-prd`：把产品上下文整理成 `.scratch/` 下的持久 PRD。
- `prototype`：在进入正式实现前，快速做一次可丢弃的工作流或 UI 原型。
- `to-issues`：在 PRD 范围确认后，把它拆成可执行任务。
- `triage`：用本地 Markdown issue tracker 对后续需求或 bug 做分类。
- `tdd`：围绕 Connector、Normalization、Scoring、Workflow Execution 等深模块设计外部行为测试。
- `improve-codebase-architecture`：等真实代码出现后，用来检查模块边界。

## 工程约束

- 优先设计接口稳定、可测试的深模块，避免堆一次性脚本。
- 数据源 Connector 要和归一化、AI 增强、工作流执行、输出生成保持隔离。
- 先保存原始数据，再做转换，这样后续规则变化时可以重放历史数据。
- Prompt 和模板必须作为配置管理，不要硬编码进业务逻辑。
- 运营侧配置要显式表达：数据源、关键词、过滤条件、Prompt 版本、输出模板、审核门槛、调度和目标渠道。
- 在“发现、增强、审核”闭环跑通前，不要急着做全自动发布。

## Git 原则

- Commit message 必须使用 `feat:`、`fix:`、`refactor:`、`merge:` 等明确类型开头。
- 类型后使用英文冒号，可跟一个空格，再写简短中文说明。
- **标题（第一行 subject）必须单行，总长度不超过 15 个字**（含类型前缀，如 `feat:` 也计入字数）。
- 正确格式示例：`feat: 修复登录`、`fix: 回测超时`。
- 不要使用没有类型前缀的提交信息，例如 `update`、`first commit`、`修改代码`。
- 本地执行 `npm run hooks:install` 可安装 `.githooks/commit-msg`，提交时自动校验标题长度。

## 持久规划文件

- 产品和领域词汇：`CONTEXT.md`
- Superpowers 配置：`docs/agents/`
- 初始 PRD：`.scratch/growth-automation-harness/PRD.md`
