-- Protocol Strategy Integration Migration
-- Feature: 003-protocol-strategy-integration
-- Date: 2025-09-27
-- Description: Adds support for DeFi protocol strategies (AAVE, Uniswap)

-- Create protocol enum
CREATE TYPE "public"."protocol_type" AS ENUM('AAVE', 'UNISWAP');

-- Create trade status enum if not exists
DO $$ BEGIN
  CREATE TYPE "public"."trade_confirmation_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXECUTING', 'EXECUTED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Strategies table
CREATE TABLE IF NOT EXISTS "strategies" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "alpha_generator_id" uuid NOT NULL REFERENCES "alpha_generators"("generator_id"),
  "name" varchar(255) UNIQUE NOT NULL,
  "description" text,
  "protocol" "protocol_type" NOT NULL,
  "functions" jsonb NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_protocol" CHECK ("protocol" IN ('AAVE', 'UNISWAP')),
  CONSTRAINT "chk_functions_array" CHECK (jsonb_array_length("functions") >= 2 AND jsonb_array_length("functions") <= 3)
);

-- Indexes for strategies
CREATE INDEX "idx_strategies_generator" ON "strategies"("alpha_generator_id");
CREATE INDEX "idx_strategies_protocol" ON "strategies"("protocol");
CREATE UNIQUE INDEX "idx_strategies_name_lower" ON "strategies"(LOWER("name"));
CREATE INDEX "idx_strategies_active" ON "strategies"("is_active");

-- Trade broadcasts table
CREATE TABLE IF NOT EXISTS "trade_broadcasts" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "strategy_id" uuid NOT NULL REFERENCES "strategies"("id"),
  "alpha_generator_id" uuid NOT NULL REFERENCES "alpha_generators"("generator_id"),
  "function_name" varchar(100) NOT NULL,
  "protocol" "protocol_type" NOT NULL,
  "parameters" jsonb NOT NULL,
  "contract_address" varchar(42) NOT NULL,
  "gas_estimate" varchar(100) NOT NULL,
  "network" varchar(50) NOT NULL,
  "correlation_id" varchar(100) UNIQUE NOT NULL,
  "broadcast_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "expires_at" timestamp with time zone NOT NULL
);

-- Indexes for trade broadcasts
CREATE INDEX "idx_broadcasts_strategy" ON "trade_broadcasts"("strategy_id");
CREATE INDEX "idx_broadcasts_generator" ON "trade_broadcasts"("alpha_generator_id");
CREATE INDEX "idx_broadcasts_correlation" ON "trade_broadcasts"("correlation_id");
CREATE INDEX "idx_broadcasts_expires" ON "trade_broadcasts"("expires_at");

-- Trade confirmations table (protocol strategy version)
CREATE TABLE IF NOT EXISTS "protocol_trade_confirmations" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "trade_broadcast_id" uuid NOT NULL REFERENCES "trade_broadcasts"("id"),
  "alpha_consumer_id" uuid NOT NULL REFERENCES "alpha_consumers"("consumer_id"),
  "original_parameters" jsonb NOT NULL,
  "modified_parameters" jsonb NOT NULL,
  "status" "trade_confirmation_status" DEFAULT 'PENDING' NOT NULL,
  "gas_price" varchar(100),
  "transaction_hash" varchar(66),
  "error_message" text,
  "received_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "decided_at" timestamp with time zone,
  "executed_at" timestamp with time zone,
  CONSTRAINT "chk_confirmation_status" CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXECUTING', 'EXECUTED', 'FAILED'))
);

-- Indexes for trade confirmations
CREATE INDEX "idx_protocol_confirmations_broadcast" ON "protocol_trade_confirmations"("trade_broadcast_id");
CREATE INDEX "idx_protocol_confirmations_consumer" ON "protocol_trade_confirmations"("alpha_consumer_id");
CREATE INDEX "idx_protocol_confirmations_status" ON "protocol_trade_confirmations"("status");
CREATE INDEX "idx_protocol_confirmations_received" ON "protocol_trade_confirmations"("received_at");

-- Protocol contracts table
CREATE TABLE IF NOT EXISTS "protocol_contracts" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "protocol" "protocol_type" NOT NULL,
  "contract_name" varchar(100) NOT NULL,
  "network" varchar(50) NOT NULL,
  "address" varchar(42) NOT NULL,
  "abi" jsonb NOT NULL,
  "version" varchar(20) NOT NULL,
  "is_active" boolean DEFAULT true,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("protocol", "contract_name", "network")
);

-- Indexes for protocol contracts
CREATE INDEX "idx_contracts_protocol" ON "protocol_contracts"("protocol");
CREATE INDEX "idx_contracts_network" ON "protocol_contracts"("network");
CREATE INDEX "idx_contracts_active" ON "protocol_contracts"("is_active");

-- Add GIN indexes for JSONB optimization
CREATE INDEX "idx_strategies_functions_gin" ON "strategies" USING GIN ("functions");
CREATE INDEX "idx_broadcasts_params_gin" ON "trade_broadcasts" USING GIN ("parameters");

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE
  ON "strategies" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_protocol_contracts_updated_at BEFORE UPDATE
  ON "protocol_contracts" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE "strategies" IS 'Reusable DeFi protocol strategies created by AlphaGenerators';
COMMENT ON TABLE "trade_broadcasts" IS 'Strategy execution broadcasts to subscribers';
COMMENT ON TABLE "protocol_trade_confirmations" IS 'Pending trades in consumer queue with parameter modification';
COMMENT ON TABLE "protocol_contracts" IS 'Protocol contract addresses and ABIs';

COMMENT ON COLUMN "strategies"."functions" IS 'Array of 2-3 protocol functions with their configurations';
COMMENT ON COLUMN "trade_broadcasts"."correlation_id" IS 'Unique ID for tracking trades across systems';
COMMENT ON COLUMN "protocol_trade_confirmations"."modified_parameters" IS 'Consumer-modified parameters (value/amount only)';
COMMENT ON COLUMN "protocol_contracts"."abi" IS 'Contract ABI for function calls';