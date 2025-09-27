-- Migration: Consolidate Strategy Tables
-- Purpose: Merge protocol_strategies into strategies table for unified system
-- Date: 2025-09-27
-- Issue: Dual strategy systems causing confusion and data sync issues

-- Step 1: Migrate any existing data from protocol_strategies to strategies table
-- Note: Only run if protocol_strategies has data that needs to be preserved
INSERT INTO strategies (
  strategy_id,
  strategy_name,
  strategy_description,
  alpha_generator_address,
  supported_protocols,
  strategy_json,
  subscriber_count,
  total_volume,
  is_active,
  created_at,
  updated_at
)
SELECT
  CONCAT('proto_', id) AS strategy_id,  -- Prefix to avoid ID conflicts
  name AS strategy_name,
  description AS strategy_description,
  -- Convert UUID reference to wallet address by joining with alpha_generators
  COALESCE(
    (SELECT generator_address FROM alpha_generators WHERE generator_id = ps.alpha_generator_id),
    '0x0000000000000000000000000000000000000000'
  ) AS alpha_generator_address,
  -- Store protocol as array in supported_protocols
  ARRAY[protocol]::jsonb AS supported_protocols,
  -- Store functions with protocol info in strategy_json
  jsonb_build_object(
    'protocol', protocol,
    'functions', functions
  ) AS strategy_json,
  0 AS subscriber_count,  -- Default subscriber count
  '0' AS total_volume,    -- Default volume
  is_active,
  created_at,
  updated_at
FROM protocol_strategies ps
WHERE NOT EXISTS (
  -- Avoid duplicates if strategy was already migrated
  SELECT 1 FROM strategies s
  WHERE s.strategy_name = ps.name
);

-- Step 2: Update trade_broadcasts to reference strategies table instead
-- First add a temporary column to map the relationship
ALTER TABLE trade_broadcasts
  ADD COLUMN IF NOT EXISTS legacy_strategy_id uuid;

-- Store the old reference
UPDATE trade_broadcasts
  SET legacy_strategy_id = strategy_id
  WHERE legacy_strategy_id IS NULL;

-- Update strategy_id to use the new text-based ID
UPDATE trade_broadcasts tb
SET strategy_id = (
  SELECT CONCAT('proto_', ps.id)
  FROM protocol_strategies ps
  WHERE ps.id = tb.legacy_strategy_id::uuid
)
WHERE EXISTS (
  SELECT 1 FROM protocol_strategies ps
  WHERE ps.id = tb.legacy_strategy_id::uuid
);

-- Step 3: Update protocol_trade_confirmations similarly
ALTER TABLE protocol_trade_confirmations
  ADD COLUMN IF NOT EXISTS legacy_trade_broadcast_id uuid;

UPDATE protocol_trade_confirmations
  SET legacy_trade_broadcast_id = trade_broadcast_id::uuid
  WHERE legacy_trade_broadcast_id IS NULL
  AND trade_broadcast_id IS NOT NULL;

-- Step 4: Drop the views that are no longer needed
DROP VIEW IF EXISTS strategies CASCADE;  -- This was the compatibility view
DROP VIEW IF EXISTS trade_confirmations CASCADE;
DROP VIEW IF EXISTS protocols CASCADE;

-- Step 5: Create a simpler view for protocol strategies if needed for backward compatibility
-- This view filters strategies that have protocol information
CREATE OR REPLACE VIEW protocol_strategies_view AS
SELECT
  strategy_id AS id,
  alpha_generator_address,
  strategy_name AS name,
  strategy_description AS description,
  -- Extract protocol from supported_protocols array or strategy_json
  COALESCE(
    (supported_protocols->0)::text,
    (strategy_json->>'protocol')::text
  ) AS protocol,
  -- Extract functions from strategy_json
  COALESCE(
    strategy_json->'functions',
    '[]'::jsonb
  ) AS functions,
  is_active,
  created_at,
  updated_at
FROM strategies
WHERE
  -- Only show strategies that have protocol information
  (supported_protocols IS NOT NULL AND jsonb_array_length(supported_protocols) > 0)
  OR (strategy_json->>'protocol' IS NOT NULL);

-- Step 6: Drop the old protocol_strategies table (only after confirming migration)
-- IMPORTANT: Uncomment these lines only after verifying data migration is successful
-- DROP TABLE IF EXISTS protocol_strategies CASCADE;
-- DROP TABLE IF EXISTS protocol_contracts CASCADE;  -- If no longer needed
-- DROP TABLE IF EXISTS protocol_trade_confirmations CASCADE;  -- If migrating to trade_confirmations

-- Step 7: Add comments for documentation
COMMENT ON VIEW protocol_strategies_view IS 'View for accessing protocol-specific strategies from unified strategies table';

-- Step 8: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_strategies_protocol
  ON strategies((supported_protocols->0));

CREATE INDEX IF NOT EXISTS idx_strategies_json_protocol
  ON strategies((strategy_json->>'protocol'));

-- Step 9: Update any foreign key constraints if needed
-- Note: Since we're using text IDs, we don't need strict foreign keys

-- Verification query (run manually to check migration)
-- SELECT COUNT(*) as migrated_count FROM strategies WHERE strategy_id LIKE 'proto_%';