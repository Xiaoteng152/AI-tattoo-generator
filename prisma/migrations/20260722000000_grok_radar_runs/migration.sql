-- CreateEnum
CREATE TYPE "GrokRadarRunStatus" AS ENUM ('RESERVED', 'RUNNING', 'UPLOAD_PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "grok_radar_runs" (
    "id" TEXT NOT NULL,
    "status" "GrokRadarRunStatus" NOT NULL,
    "quota_window_start" TIMESTAMP(3) NOT NULL,
    "quota_window_end" TIMESTAMP(3) NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "model" TEXT NOT NULL,
    "reasoning_effort" TEXT NOT NULL,
    "creator_handles" TEXT[],
    "keywords" TEXT[],
    "strategy_version" INTEGER NOT NULL,
    "strategy_snapshot" TEXT NOT NULL,
    "usage" JSONB,
    "raw_payload" JSONB,
    "ingestion_result" JSONB,
    "error" TEXT,
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "grok_radar_runs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "creator_raw_items" ADD COLUMN "grok_run_id" TEXT;

-- AlterTable
ALTER TABLE "trading_digests" ADD COLUMN "source_grok_run_id" TEXT;

-- CreateIndex
CREATE INDEX "grok_radar_runs_quota_window_start_status_idx" ON "grok_radar_runs"("quota_window_start", "status");

-- CreateIndex
CREATE INDEX "grok_radar_runs_completed_at_idx" ON "grok_radar_runs"("completed_at");

-- CreateIndex
CREATE INDEX "creator_raw_items_grok_run_id_idx" ON "creator_raw_items"("grok_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "trading_digests_source_grok_run_id_key" ON "trading_digests"("source_grok_run_id");

-- AddForeignKey
ALTER TABLE "creator_raw_items" ADD CONSTRAINT "creator_raw_items_grok_run_id_fkey" FOREIGN KEY ("grok_run_id") REFERENCES "grok_radar_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_digests" ADD CONSTRAINT "trading_digests_source_grok_run_id_fkey" FOREIGN KEY ("source_grok_run_id") REFERENCES "grok_radar_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
