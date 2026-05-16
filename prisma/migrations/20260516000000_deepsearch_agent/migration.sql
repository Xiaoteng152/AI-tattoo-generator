CREATE TYPE "DeepSearchRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "deepsearch_runs" (
    "id" TEXT NOT NULL,
    "status" "DeepSearchRunStatus" NOT NULL DEFAULT 'PENDING',
    "goal" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "seed_keywords" TEXT[],
    "current_step" TEXT NOT NULL DEFAULT 'pending',
    "questions_completed" INTEGER NOT NULL DEFAULT 0,
    "questions_total" INTEGER NOT NULL DEFAULT 0,
    "raw_item_count" INTEGER NOT NULL DEFAULT 0,
    "evidence_bundle_count" INTEGER NOT NULL DEFAULT 0,
    "opportunity_count" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deepsearch_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deepsearch_plans" (
    "id" TEXT NOT NULL,
    "deepsearch_run_id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "seed_keywords" TEXT[],
    "expected_outputs" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deepsearch_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deepsearch_questions" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "sources" TEXT[],
    "queries" TEXT[],
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deepsearch_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence_bundles" (
    "id" TEXT NOT NULL,
    "deepsearch_run_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "opportunity_candidate" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "compressed_summary" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_bundles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deepsearch_reports" (
    "id" TEXT NOT NULL,
    "deepsearch_run_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "top_opportunities" JSONB NOT NULL,
    "risks" TEXT[],
    "next_search_suggestions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deepsearch_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deepsearch_plans_deepsearch_run_id_key" ON "deepsearch_plans"("deepsearch_run_id");
CREATE UNIQUE INDEX "deepsearch_reports_deepsearch_run_id_key" ON "deepsearch_reports"("deepsearch_run_id");

ALTER TABLE "deepsearch_plans" ADD CONSTRAINT "deepsearch_plans_deepsearch_run_id_fkey" FOREIGN KEY ("deepsearch_run_id") REFERENCES "deepsearch_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deepsearch_questions" ADD CONSTRAINT "deepsearch_questions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "deepsearch_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_bundles" ADD CONSTRAINT "evidence_bundles_deepsearch_run_id_fkey" FOREIGN KEY ("deepsearch_run_id") REFERENCES "deepsearch_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_bundles" ADD CONSTRAINT "evidence_bundles_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "deepsearch_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deepsearch_reports" ADD CONSTRAINT "deepsearch_reports_deepsearch_run_id_fkey" FOREIGN KEY ("deepsearch_run_id") REFERENCES "deepsearch_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
