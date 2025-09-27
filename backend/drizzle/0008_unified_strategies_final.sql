-- Migration: Final Strategy Table Unification
-- Purpose: Complete consolidation of all strategy-related tables into one
-- Date: 2025-09-27
-- Principle: One table for one concept - no parallel structures

-- DEVELOPMENT MODE: This migration assumes data can be recreated if needed

-- Step 1: Add any missing columns to strategies table for protocol support
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS protocol varchar(50),
  ADD COLUMN IF NOT EXISTS functions jsonb;

-- Step 2: Create proper structure if strategies table doesn't exist with all needed columns
CREATE TABLE IF NOT EXISTS strategies_unified (
  strategy_id text PRIMARY KEY DEFAULT ('strat_' || gen_random_uuid()),
  strategy_name varchar(255) UNIQUE NOT NULL,
  strategy_description text,
  -- Protocol-specific fields
  protocol varchar(50), -- Single protocol (AAVE, UNISWAP, etc)
  supported_protocols jsonb, -- Array of protocols for multi-protocol strategies
  functions jsonb, -- Direct protocol functions storage
  strategy_json jsonb, -- Flexible JSON storage for any strategy data
  -- Generator reference
  alpha_generator_address text NOT NULL,
  alpha_generator_id uuid, -- Optional UUID reference if needed
  -- Metrics
  subscriber_count integer DEFAULT 0 NOT NULL,
  total_volume numeric(78, 0) DEFAULT '0',
  success_rate numeric(5, 2) DEFAULT 0,
  total_executions integer DEFAULT 0,
  -- Status
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Step 3: Migrate existing data from strategies to unified structure
INSERT INTO strategies_unified (
  strategy_id,
  strategy_name,
  strategy_description,
  protocol,
  supported_protocols,
  functions,
  strategy_json,
  alpha_generator_address,
  subscriber_count,
  total_volume,
  is_active,
  created_at,
  updated_at
)
SELECT
  strategy_id,
  strategy_name,
  strategy_description,
  -- Extract protocol from various possible locations
  COALESCE(
    (strategy_json->>'protocol')::varchar,
    (supported_protocols->>0)::varchar,
    NULL
  ) as protocol,
  supported_protocols,
  COALESCE(
    strategy_json->'functions',
    NULL
  ) as functions,
  strategy_json,
  alpha_generator_address,
  subscriber_count,
  total_volume,
  is_active,
  created_at,
  updated_at
FROM strategies
ON CONFLICT (strategy_id) DO NOTHING;

-- Step 4: Migrate any data from protocol_strategies if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'protocol_strategies') THEN
    INSERT INTO strategies_unified (
      strategy_id,
      strategy_name,
      strategy_description,
      protocol,
      supported_protocols,
      functions,
      strategy_json,
      alpha_generator_address,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      'proto_' || ps.id,
      ps.name,
      ps.description,
      ps.protocol,
      to_jsonb(ARRAY[ps.protocol]),
      ps.functions,
      jsonb_build_object(
        'protocol', ps.protocol,
        'functions', ps.functions
      ),
      COALESCE(
        (SELECT generator_address FROM alpha_generators WHERE generator_id = ps.alpha_generator_id),
        '0x0000000000000000000000000000000000000000'
      ),
      ps.is_active,
      ps.created_at,
      ps.updated_at
    FROM protocol_strategies ps
    ON CONFLICT (strategy_id) DO NOTHING;
  END IF;
END $$;

-- Step 5: Drop old strategies table and rename new one
DROP TABLE IF EXISTS strategies CASCADE;
ALTER TABLE strategies_unified RENAME TO strategies;

-- Step 6: Drop all redundant protocol-related tables and views
DROP VIEW IF EXISTS protocol_strategies_view CASCADE;
DROP VIEW IF EXISTS strategies CASCADE; -- This was a view
DROP VIEW IF EXISTS protocols CASCADE;
DROP TABLE IF EXISTS trade_confirmations CASCADE;
DROP TABLE IF EXISTS protocol_strategies CASCADE;
DROP TABLE IF EXISTS protocol_contracts CASCADE;
DROP TABLE IF EXISTS protocol_trade_confirmations CASCADE;
DROP TABLE IF EXISTS trade_broadcasts CASCADE;

-- Step 7: Create optimized indexes for the unified table
CREATE INDEX IF NOT EXISTS idx_strategies_generator ON strategies(alpha_generator_address);
CREATE INDEX IF NOT EXISTS idx_strategies_protocol ON strategies(protocol);
CREATE INDEX IF NOT EXISTS idx_strategies_active ON strategies(is_active);
CREATE INDEX IF NOT EXISTS idx_strategies_created ON strategies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategies_name_lower ON strategies(LOWER(strategy_name));

-- GIN indexes for JSONB columns for fast queries
CREATE INDEX IF NOT EXISTS idx_strategies_json_gin ON strategies USING GIN(strategy_json);
CREATE INDEX IF NOT EXISTS idx_strategies_functions_gin ON strategies USING GIN(functions);
CREATE INDEX IF NOT EXISTS idx_strategies_protocols_gin ON strategies USING GIN(supported_protocols);

-- Step 8: Create a simple view for protocol strategies (backward compatibility)
CREATE OR REPLACE VIEW protocol_strategy_view AS
SELECT
  strategy_id AS id,
  alpha_generator_address,
  alpha_generator_id,
  strategy_name AS name,
  strategy_description AS description,
  COALESCE(
    protocol,
    (supported_protocols->>0)::varchar,
    (strategy_json->>'protocol')::varchar
  ) AS protocol,
  COALESCE(
    functions,
    strategy_json->'functions',
    '[]'::jsonb
  ) AS functions,
  subscriber_count,
  total_volume,
  is_active,
  created_at,
  updated_at
FROM strategies
WHERE
  protocol IS NOT NULL OR
  supported_protocols IS NOT NULL OR
  (strategy_json->>'protocol') IS NOT NULL;

-- Step 9: Create trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS strategies_updated_at ON strategies;
CREATE TRIGGER strategies_updated_at
  BEFORE UPDATE ON strategies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Step 10: Add helpful comments
COMMENT ON TABLE strategies IS 'Unified table for all trading strategies including protocol strategies';
COMMENT ON COLUMN strategies.protocol IS 'Primary protocol for this strategy (AAVE, UNISWAP, etc)';
COMMENT ON COLUMN strategies.supported_protocols IS 'Array of all supported protocols';
COMMENT ON COLUMN strategies.functions IS 'Protocol-specific functions configuration';
COMMENT ON COLUMN strategies.strategy_json IS 'Flexible JSON storage for any strategy-specific data';
COMMENT ON COLUMN strategies.alpha_generator_address IS 'Wallet address of the strategy creator';

-- Verification queries (run manually)
-- SELECT COUNT(*) FROM strategies;
-- SELECT DISTINCT protocol FROM strategies WHERE protocol IS NOT NULL;
-- SELECT COUNT(*) FROM strategies WHERE functions IS NOT NULL;