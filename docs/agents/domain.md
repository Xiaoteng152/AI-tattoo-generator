# Domain Docs

这里定义工程类 skills 应该如何读取本仓库的领域文档。

## 开始探索前，先读这些

- `CONTEXT.md`：产品词汇、角色、MVP 范围和架构语言。
- `.scratch/growth-automation-harness/PRD.md`：初始产品需求。
- `docs/adr/`：如果后续新增 ADR，在改架构前需要检查相关决策。

如果某个文件不存在，直接继续，不需要报错。

## 文档结构

这是一个单上下文仓库：

```text
/
├── CONTEXT.md
├── AGENTS.md
├── docs/agents/
├── docs/adr/
└── .scratch/
```

## 使用统一领域词汇

命名模块、任务、测试或产品概念时，优先使用 `CONTEXT.md` 中的术语：Connector、Raw Item、Normalized Item、Enrichment、Opportunity、Workflow Config、Workflow Run、Output Asset、Execution Channel、Feedback Signal。

如果某个概念不在词汇表里，应该指出缺口，而不是随意创造不一致的名称。

## 标出 ADR 冲突

如果后续输出和已有 ADR 冲突，需要明确说明冲突点，并解释为什么可能值得重新讨论该决策。
