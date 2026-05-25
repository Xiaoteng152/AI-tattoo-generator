# PRD：Growth Automation Harness

Status: ready-for-agent

这是 Growth Automation Harness 的文档入口。原来的大 PRD 已按职责拆成多个文档，避免需求、UI、DeepSearch 架构、数据库、部署和测试评审混在一起。

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

5. [数据库接入与持久化闭环](./DATABASE_INTEGRATION.md)
   - 本地 PostgreSQL 接入
   - Workflow Run 历史和 Raw Item 证据链
   - DeepSearch run state 持久化
   - 历史查询 API 和 UI 接入顺序

6. [Vercel + Supabase + Next.js 后端部署方案](./DEPLOYMENT_ARCHITECTURE.md)
   - Vercel / Next.js API 分工
   - Supabase Postgres 与 Prisma 连接策略
   - Auth.js、Cron、长任务边界
   - 线上部署阶段和验收标准

7. [需求文档 · 已知限制](./REQUIREMENTS.md#已知限制与未实现)
   - X API credits 未充值时的 fallback 策略
   - 未实现的官方 X 搜索与分页能力

8. [KOL 内容增长 Agent](./KOL_CONTENT_AGENT.md)
   - AI 产品增长人设
   - LangGraph 断点式内容生产工作流
   - Search MVP / V1 / V2 / V3 路线图
   - 爆款方向、素材卡、观点卡和成稿组合包
   - DeepSearch 证据链到长推/文章输出

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

## KOL 内容增长闭环

```txt
AI Product Case / Topic
  -> Signal Collection
  -> Viral Direction Candidates
  -> Human Selection
  -> Material Board
  -> Opinion Cards
  -> Draft Generation
  -> Human Review
  -> Final Article / Thread / Material Pack
```
