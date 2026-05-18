# PRD：Growth Automation Harness

Status: ready-for-agent

这是 Growth Automation Harness 的文档入口。原来的大 PRD 已按职责拆成 4 个文档，避免需求、UI、DeepSearch 架构和测试评审混在一起。

## 文档结构

1. [需求文档](./REQUIREMENTS.md)
   - 问题陈述
   - 解决方案
   - 用户故事
   - 实现决策
   - 不在范围内

2. [UI 文档](./UI.md)
   - 产品信息架构
   - 核心页面
   - 页面状态
   - 演示路径

3. [DeepSearch 设计文档](./DEEPSEARCH.md)
   - 垂类分类
   - Subagent 设计
   - Evidence Extractor
   - 上下文窗口
   - 数据结构
   - MVP 顺序

4. [测试评审文档](./TEST_REVIEW.md)
   - 测试策略
   - 测试用例
   - UI 回归
   - Demo 前检查清单

## 项目一句话

Growth Automation Harness 是一个面向海外 C 端产品的增长自动化系统：从 Reddit、Etsy、Pinterest、YouTube 等站外来源提取信号，完成清洗、增强、机会评分、资产生成和反馈追踪。

第一个作品集演示垂类固定为 **AI tattoo generator**。

## MVP 闭环

```txt
Workflow Config
  -> Extraction
  -> Raw Item
  -> Normalization
  -> Enrichment
  -> Opportunity
  -> Output Asset
  -> Review / Export
  -> Feedback Signal
```

## DeepSearch 闭环

```txt
User Query
  -> Vertical Router
  -> Research Planner
  -> Source Subagents
  -> Evidence Extractor
  -> Context Manager
  -> Synthesis Agent
  -> Opportunity Cards
  -> Workflow Tasks / Output Assets
```
