-- Protocol Strategy Integration Enhanced Migration
-- Feature: 003-protocol-strategy-integration
-- Date: 2025-09-27
-- Description: Updates existing strategies table and adds protocol strategy support

-- Drop existing strategies table columns and recreate with proper structure
ALTER TABLE "strategies"
  DROP COLUMN IF EXISTS strategy_id CASCADE,
  DROP COLUMN IF EXISTS strategy_name CASCADE,
  DROP COLUMN IF EXISTS strategy_description CASCADE,
  DROP COLUMN IF EXISTS supported_protocols CASCADE,
  DROP COLUMN IF EXISTS strategy_json CASCADE,
  DROP COLUMN IF EXISTS alpha_generator_address CASCADE,
  DROP COLUMN IF EXISTS subscriber_count CASCADE,
  DROP COLUMN IF EXISTS total_volume CASCADE;

-- Add new columns to strategies table to match our design
ALTER TABLE "strategies"
  ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  ADD COLUMN IF NOT EXISTS "alpha_generator_id" uuid,
  ADD COLUMN IF NOT EXISTS "name" varchar(255) UNIQUE NOT NULL,
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "protocol" varchar(50) NOT NULL,
  ADD COLUMN IF NOT EXISTS "functions" jsonb NOT NULL,
  ALTER COLUMN "is_active" SET DEFAULT true,
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Add primary key
ALTER TABLE "strategies"
  DROP CONSTRAINT IF EXISTS strategies_pkey,
  ADD CONSTRAINT strategies_pkey PRIMARY KEY (id);

-- Add foreign key to alpha_generators
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alpha_generators') THEN
    ALTER TABLE "strategies"
      ADD CONSTRAINT fk_strategies_generator
      FOREIGN KEY (alpha_generator_id)
      REFERENCES alpha_generators(generator_id);
  END IF;
END $$;

-- Add constraints
ALTER TABLE "strategies"
  ADD CONSTRAINT "chk_protocol" CHECK (protocol IN ('AAVE', 'UNISWAP')),
  ADD CONSTRAINT "chk_functions_array" CHECK (jsonb_array_length(functions) >= 2 AND jsonb_array_length(functions) <= 3);

-- Create indexes for strategies
CREATE INDEX IF NOT EXISTS "idx_strategies_generator" ON "strategies"("alpha_generator_id");
CREATE INDEX IF NOT EXISTS "idx_strategies_protocol" ON "strategies"("protocol");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_strategies_name_lower" ON "strategies"(LOWER("name"));
CREATE INDEX IF NOT EXISTS "idx_strategies_active" ON "strategies"("is_active");

-- Trade broadcasts table (new table)
CREATE TABLE IF NOT EXISTS "trade_broadcasts" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "strategy_id" uuid NOT NULL REFERENCES "strategies"("id"),
  "alpha_generator_id" uuid REFERENCES "alpha_generators"("generator_id"),
  "function_name" varchar(100) NOT NULL,
  "protocol" varchar(50) NOT NULL,
  "parameters" jsonb NOT NULL,
  "contract_address" varchar(42) NOT NULL,
  "gas_estimate" varchar(100) NOT NULL,
  "network" varchar(50) NOT NULL,
  "correlation_id" varchar(100) UNIQUE NOT NULL,
  "broadcast_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "expires_at" timestamp with time zone NOT NULL
);

-- Indexes for trade broadcasts
CREATE INDEX IF NOT EXISTS "idx_broadcasts_strategy" ON "trade_broadcasts"("strategy_id");
CREATE INDEX IF NOT EXISTS "idx_broadcasts_generator" ON "trade_broadcasts"("alpha_generator_id");
CREATE INDEX IF NOT EXISTS "idx_broadcasts_correlation" ON "trade_broadcasts"("correlation_id");
CREATE INDEX IF NOT EXISTS "idx_broadcasts_expires" ON "trade_broadcasts"("expires_at");

-- Protocol trade confirmations table (separate from existing trade_confirmations)
CREATE TABLE IF NOT EXISTS "protocol_trade_confirmations" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "trade_broadcast_id" uuid NOT NULL REFERENCES "trade_broadcasts"("id"),
  "alpha_consumer_id" uuid REFERENCES "alpha_consumers"("consumer_id"),
  "original_parameters" jsonb NOT NULL,
  "modified_parameters" jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'PENDING' NOT NULL,
  "gas_price" varchar(100),
  "transaction_hash" varchar(66),
  "error_message" text,
  "received_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "decided_at" timestamp with time zone,
  "executed_at" timestamp with time zone,
  CONSTRAINT "chk_confirmation_status" CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXECUTING', 'EXECUTED', 'FAILED'))
);

-- Indexes for protocol trade confirmations
CREATE INDEX IF NOT EXISTS "idx_protocol_confirmations_broadcast" ON "protocol_trade_confirmations"("trade_broadcast_id");
CREATE INDEX IF NOT EXISTS "idx_protocol_confirmations_consumer" ON "protocol_trade_confirmations"("alpha_consumer_id");
CREATE INDEX IF NOT EXISTS "idx_protocol_confirmations_status" ON "protocol_trade_confirmations"("status");
CREATE INDEX IF NOT EXISTS "idx_protocol_confirmations_received" ON "protocol_trade_confirmations"("received_at");

-- Update protocol_contracts table (already exists, just add columns if needed)
ALTER TABLE "protocol_contracts"
  ADD COLUMN IF NOT EXISTS "protocol" varchar(50),
  ADD COLUMN IF NOT EXISTS "contract_name" varchar(100),
  ADD COLUMN IF NOT EXISTS "network" varchar(50),
  ADD COLUMN IF NOT EXISTS "address" varchar(42),
  ADD COLUMN IF NOT EXISTS "abi" jsonb,
  ADD COLUMN IF NOT EXISTS "version" varchar(20),
  ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'protocol_contracts_protocol_contract_name_network_key'
  ) THEN
    ALTER TABLE protocol_contracts
      ADD CONSTRAINT protocol_contracts_protocol_contract_name_network_key
      UNIQUE(protocol, contract_name, network);
  END IF;
END $$;

-- Add GIN indexes for JSONB optimization
CREATE INDEX IF NOT EXISTS "idx_strategies_functions_gin" ON "strategies" USING GIN ("functions");
CREATE INDEX IF NOT EXISTS "idx_broadcasts_params_gin" ON "trade_broadcasts" USING GIN ("parameters");

-- Update or create trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add/update triggers
DROP TRIGGER IF EXISTS update_strategies_updated_at ON strategies;
CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE
  ON "strategies" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_protocol_contracts_updated_at ON protocol_contracts;
CREATE TRIGGER update_protocol_contracts_updated_at BEFORE UPDATE
  ON "protocol_contracts" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add documentation comments
COMMENT ON TABLE "strategies" IS 'Reusable DeFi protocol strategies created by AlphaGenerators';
COMMENT ON TABLE "trade_broadcasts" IS 'Strategy execution broadcasts to subscribers';
COMMENT ON TABLE "protocol_trade_confirmations" IS 'Pending trades in consumer queue with parameter modification';
COMMENT ON TABLE "protocol_contracts" IS 'Protocol contract addresses and ABIs';

COMMENT ON COLUMN "strategies"."functions" IS 'Array of 2-3 protocol functions with their configurations';
COMMENT ON COLUMN "trade_broadcasts"."correlation_id" IS 'Unique ID for tracking trades across systems';
COMMENT ON COLUMN "protocol_trade_confirmations"."modified_parameters" IS 'Consumer-modified parameters (value/amount only)';
COMMENT ON COLUMN "protocol_contracts"."abi" IS 'Contract ABI for function calls';