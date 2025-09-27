CREATE TYPE "public"."trade_status" AS ENUM('pending', 'executed', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE "alpha_consumers" (
	"consumer_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"bio" text,
	"profile_image" varchar(500),
	"preferences" jsonb DEFAULT '{"notificationsEnabled":true,"autoSubscribe":false}'::jsonb,
	"stats" jsonb DEFAULT '{"totalSubscriptions":0,"activeSubscriptions":0,"totalInvested":0,"totalReturns":0,"avgROI":0}'::jsonb,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alpha_consumers_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "strategy_deliveries" (
	"delivery_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"consumer_address" varchar(42) NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"delivery_status" varchar(20) DEFAULT 'queued' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_generators_performance";--> statement-breakpoint
ALTER TABLE "alpha_generators" ALTER COLUMN "performance_stats" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "subscription_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "is_active" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "strategy_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "subscribed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "subscriptions" SET "expires_at" = "created_at" + INTERVAL '30 days' WHERE "expires_at" IS NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_confirmations" ADD COLUMN "alpha_generator_address" text;--> statement-breakpoint
UPDATE "trade_confirmations" SET "alpha_generator_address" = '' WHERE "alpha_generator_address" IS NULL;--> statement-breakpoint
ALTER TABLE "trade_confirmations" ALTER COLUMN "alpha_generator_address" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_confirmations" ADD COLUMN "status" "trade_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_confirmations" ADD COLUMN "expiry_time" timestamp with time zone;--> statement-breakpoint
UPDATE "trade_confirmations" SET "expiry_time" = "created_at" + INTERVAL '1 hour' WHERE "expiry_time" IS NULL;--> statement-breakpoint
ALTER TABLE "trade_confirmations" ALTER COLUMN "expiry_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_confirmations" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "trade_confirmations" ADD COLUMN "function_name" text;--> statement-breakpoint
ALTER TABLE "trade_confirmations" ADD COLUMN "function_abi" jsonb;--> statement-breakpoint
ALTER TABLE "trade_confirmations" ADD COLUMN "parameters" jsonb;--> statement-breakpoint
ALTER TABLE "trade_confirmations" ADD COLUMN "contract_address" text;--> statement-breakpoint
CREATE INDEX "idx_consumers_address" ON "alpha_consumers" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_consumers_active" ON "alpha_consumers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_consumers_name" ON "alpha_consumers" USING btree ("display_name");