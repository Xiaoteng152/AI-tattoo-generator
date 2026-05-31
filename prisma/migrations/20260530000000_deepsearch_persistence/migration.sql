-- DeepSearchRun: 补齐 query / vertical / depth 与 evidence/finding 计数
ALTER TABLE "deepsearch_runs"
  ADD COLUMN "query" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "vertical" TEXT NOT NULL DEFAULT 'ai_tattoo_generator',
  ADD COLUMN "depth" TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN "evidence_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "finding_count" INTEGER NOT NULL DEFAULT 0;

-- DeepSearchPlan: 保存 vertical / depth / context budget / prompt 版本
ALTER TABLE "deepsearch_plans"
  ADD COLUMN "vertical" TEXT NOT NULL DEFAULT 'ai_tattoo_generator',
  ADD COLUMN "depth" TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN "context_budget" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "prompt_version" TEXT NOT NULL DEFAULT 'deepsearch-v1';

-- DeepSearchQuestion: 保存分配的子 Agent
ALTER TABLE "deepsearch_questions"
  ADD COLUMN "agent" TEXT NOT NULL DEFAULT 'reddit_agent';

-- DeepSearchReport: 保存 trending / pain points / recommended actions / citations
ALTER TABLE "deepsearch_reports"
  ADD COLUMN "what_is_trending" TEXT[],
  ADD COLUMN "user_pain_points" TEXT[],
  ADD COLUMN "recommended_actions" TEXT[],
  ADD COLUMN "citations" JSONB NOT NULL DEFAULT '[]';
