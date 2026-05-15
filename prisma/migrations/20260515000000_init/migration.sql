CREATE TYPE "WorkflowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "RunStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "OutputAssetStatus" AS ENUM ('DRAFT', 'REVIEWED', 'EXPORTED', 'DISCARDED');

CREATE TABLE "workflow_configs" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "product_direction" TEXT NOT NULL,
  "keywords" TEXT[],
  "filters" JSONB NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "output_template" TEXT NOT NULL,
  "review_threshold" INTEGER NOT NULL DEFAULT 70,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_sources" (
  "id" TEXT NOT NULL,
  "workflow_config_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_runs" (
  "id" TEXT NOT NULL,
  "workflow_config_id" TEXT NOT NULL,
  "status" "WorkflowRunStatus" NOT NULL DEFAULT 'PENDING',
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "summary" JSONB,
  "error" TEXT,
  CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "run_steps" (
  "id" TEXT NOT NULL,
  "workflow_run_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "RunStepStatus" NOT NULL DEFAULT 'PENDING',
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "metadata" JSONB,
  "error" TEXT,
  CONSTRAINT "run_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "raw_items" (
  "id" TEXT NOT NULL,
  "workflow_run_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "source_url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "metrics" JSONB NOT NULL,
  "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raw_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "normalized_items" (
  "id" TEXT NOT NULL,
  "workflow_run_id" TEXT NOT NULL,
  "raw_item_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "author" TEXT,
  "source_url" TEXT NOT NULL,
  "tags" TEXT[],
  "language" TEXT NOT NULL DEFAULT 'en',
  "engagement_score" INTEGER NOT NULL,
  "normalized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "normalized_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enrichments" (
  "id" TEXT NOT NULL,
  "workflow_run_id" TEXT NOT NULL,
  "normalized_item_id" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "pain_points" TEXT[],
  "intent" TEXT NOT NULL,
  "trend_type" TEXT NOT NULL,
  "keywords" TEXT[],
  "content_angles" TEXT[],
  "evidence_summary" TEXT NOT NULL,
  "opportunity_score" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enrichments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opportunities" (
  "id" TEXT NOT NULL,
  "workflow_run_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "confidence" INTEGER NOT NULL,
  "evidence_summary" TEXT NOT NULL,
  "source_urls" TEXT[],
  "recommended_act" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "output_assets" (
  "id" TEXT NOT NULL,
  "workflow_run_id" TEXT NOT NULL,
  "opportunity_id" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" "OutputAssetStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "output_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "raw_items_source_external_id_key" ON "raw_items"("source", "external_id");

ALTER TABLE "workflow_sources" ADD CONSTRAINT "workflow_sources_workflow_config_id_fkey" FOREIGN KEY ("workflow_config_id") REFERENCES "workflow_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_config_id_fkey" FOREIGN KEY ("workflow_config_id") REFERENCES "workflow_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "raw_items" ADD CONSTRAINT "raw_items_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "normalized_items" ADD CONSTRAINT "normalized_items_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "normalized_items" ADD CONSTRAINT "normalized_items_raw_item_id_fkey" FOREIGN KEY ("raw_item_id") REFERENCES "raw_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_normalized_item_id_fkey" FOREIGN KEY ("normalized_item_id") REFERENCES "normalized_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "output_assets" ADD CONSTRAINT "output_assets_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "output_assets" ADD CONSTRAINT "output_assets_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
