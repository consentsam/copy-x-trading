-- Migration: Fix Strategies View Column Mappings
-- Purpose: Properly map protocol_strategies columns to match application expectations
-- Date: 2025-09-27
-- Issue: Frontend expects different column names than what the view provides

-- Drop existing view to recreate with proper column mappings
DROP VIEW IF EXISTS strategies CASCADE;

-- Create strategies view with proper column aliases matching app expectations
CREATE OR REPLACE VIEW strategies AS
SELECT
  id AS "strategyId",                          -- App expects strategyId, not id
  name AS "strategyName",                       -- App expects strategyName, not name
  description AS "strategyDescription",         -- App expects strategyDescription
  COALESCE(
    (SELECT wallet_address FROM alpha_generators WHERE generator_id = ps.alpha_generator_id),
    '0x0000000000000000000000000000000000000000'
  ) AS "alphaGeneratorAddress",                 -- App expects wallet address, not UUID
  ARRAY[protocol]::text[] AS "supportedProtocols", -- App expects array of protocols
  functions AS "strategyJSON",                  -- Map functions to strategyJSON
  COALESCE(
    (SELECT COUNT(*) FROM subscriptions WHERE alpha_generator_address =
      (SELECT wallet_address FROM alpha_generators WHERE generator_id = ps.alpha_generator_id)
      AND is_active = true
    ), 0
  )::integer AS "subscriberCount",              -- Calculate subscriber count
  '0'::numeric(78,0) AS "totalVolume",         -- Default total volume
  is_active AS "isActive",                      -- App expects isActive
  created_at AS "createdAt",                     -- App expects camelCase
  updated_at AS "updatedAt",                     -- App expects camelCase
  -- Additional fields for backward compatibility
  id AS "strategy_id",                          -- Alternative column name
  COALESCE(
    (SELECT wallet_address FROM alpha_generators WHERE generator_id = ps.alpha_generator_id),
    '0x0000000000000000000000000000000000000000'
  ) AS "walletAddress"                          -- Some queries may expect walletAddress
FROM protocol_strategies ps;

-- Create indexes for performance on the underlying table (if not exists)
CREATE INDEX IF NOT EXISTS idx_protocol_strategies_id_active
  ON protocol_strategies(id, is_active);

CREATE INDEX IF NOT EXISTS idx_protocol_strategies_generator_active
  ON protocol_strategies(alpha_generator_id, is_active);

-- Add comment explaining the compatibility layer
COMMENT ON VIEW strategies IS 'Compatibility view mapping protocol_strategies to match app expectations with proper column names';

-- Grant permissions (adjust based on your database user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON strategies TO alphaengine_user;