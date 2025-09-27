-- Migration: Protocol Strategies Compatibility Layer
-- Purpose: Create views to support both table naming conventions
-- Date: 2025-09-27

-- Create views for backward compatibility with worktree branch
-- These views allow the worktree code to work with the new table structure

-- View for strategies (maps to protocol_strategies)
CREATE OR REPLACE VIEW strategies AS
SELECT
  id,
  alpha_generator_id,
  name,
  description,
  protocol,
  functions,
  is_active,
  created_at,
  updated_at
FROM protocol_strategies;

-- View for trade_confirmations (maps to protocol_trade_confirmations)
CREATE OR REPLACE VIEW trade_confirmations AS
SELECT
  id,
  trade_broadcast_id,
  alpha_consumer_id,
  original_parameters,
  modified_parameters,
  status,
  gas_price,
  transaction_hash,
  error_message,
  received_at,
  decided_at,
  executed_at
FROM protocol_trade_confirmations;

-- View for protocols (maps protocol_contracts data)
CREATE OR REPLACE VIEW protocols AS
SELECT
  id,
  protocol,
  contract_name as name,
  network,
  address,
  abi,
  version,
  is_active,
  updated_at
FROM protocol_contracts;

-- Create indexes on views for performance
CREATE INDEX IF NOT EXISTS idx_view_strategies_generator
  ON protocol_strategies(alpha_generator_id);

CREATE INDEX IF NOT EXISTS idx_view_confirmations_consumer
  ON protocol_trade_confirmations(alpha_consumer_id);

-- Add comment explaining the compatibility layer
COMMENT ON VIEW strategies IS 'Compatibility view for worktree branch - maps to protocol_strategies';
COMMENT ON VIEW trade_confirmations IS 'Compatibility view for worktree branch - maps to protocol_trade_confirmations';
COMMENT ON VIEW protocols IS 'Compatibility view for worktree branch - maps to protocol_contracts';

-- Grant necessary permissions (adjust based on your database user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON strategies TO alphaengine_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON trade_confirmations TO alphaengine_user;
-- GRANT SELECT ON protocols TO alphaengine_user;