CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED', 'NOT_CONFIGURED');

CREATE TABLE "watched_creators" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'x',
    "platform_user_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "newest_post_id" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watched_creators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "creator_raw_items" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'und',
    "post_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "is_initial_import" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creator_raw_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trading_strategies" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trading_strategies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trading_digests" (
    "id" TEXT NOT NULL,
    "input_key" TEXT NOT NULL,
    "creator_ids" TEXT[],
    "raw_item_ids" TEXT[],
    "summary" JSONB NOT NULL,
    "signals" JSONB NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "strategy_version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trading_digests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "digest_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "watched_creators_platform_platform_user_id_key" ON "watched_creators"("platform", "platform_user_id");
CREATE UNIQUE INDEX "watched_creators_platform_handle_key" ON "watched_creators"("platform", "handle");
CREATE UNIQUE INDEX "creator_raw_items_creator_id_external_id_key" ON "creator_raw_items"("creator_id", "external_id");
CREATE INDEX "creator_raw_items_creator_id_published_at_idx" ON "creator_raw_items"("creator_id", "published_at");
CREATE INDEX "creator_raw_items_read_at_published_at_idx" ON "creator_raw_items"("read_at", "published_at");
CREATE UNIQUE INDEX "trading_digests_input_key_key" ON "trading_digests"("input_key");
CREATE INDEX "trading_digests_created_at_idx" ON "trading_digests"("created_at");
CREATE UNIQUE INDEX "notification_deliveries_idempotency_key_key" ON "notification_deliveries"("idempotency_key");
CREATE INDEX "notification_deliveries_digest_id_idx" ON "notification_deliveries"("digest_id");

ALTER TABLE "creator_raw_items" ADD CONSTRAINT "creator_raw_items_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "watched_creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trading_digests" ADD CONSTRAINT "trading_digests_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "trading_strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_digest_id_fkey" FOREIGN KEY ("digest_id") REFERENCES "trading_digests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
