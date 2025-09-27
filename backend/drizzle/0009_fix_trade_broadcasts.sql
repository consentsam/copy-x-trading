-- Migration: Fix Trade Broadcast Tables for Unified Strategies
-- Purpose: Update trade broadcast tables to work with unified strategies table
-- Date: 2025-09-27
-- Issue: Trade broadcasts reference strategy_id as UUID but strategies table uses text

-- Step 1: Recreate trade_broadcasts table if it was dropped
CREATE TABLE IF NOT EXISTS trade_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id text NOT NULL, -- Changed from UUID to text to match strategies table
  alpha_generator_id uuid, -- Keep as UUID for now (references alpha_generators)
  function_name varchar(100) NOT NULL,
  protocol varchar(50) NOT NULL,
  parameters jsonb NOT NULL,
  contract_address varchar(42) NOT NULL,
  gas_estimate varchar(100) NOT NULL,
  network varchar(50) NOT NULL,
  correlation_id varchar(100) UNIQUE NOT NULL,
  broadcast_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamp with time zone NOT NULL
);

-- Step 2: Recreate protocol_trade_confirmations table if dropped
CREATE TABLE IF NOT EXISTS protocol_trade_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_broadcast_id uuid NOT NULL REFERENCES trade_broadcasts(id),
  alpha_consumer_id uuid, -- References alpha_consumers
  original_parameters jsonb NOT NULL,
  modified_parameters jsonb NOT NULL,
  status varchar(20) DEFAULT 'PENDING' NOT NULL CHECK (
    status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXECUTING', 'EXECUTED', 'FAILED')
  ),
  gas_price varchar(100),
  transaction_hash varchar(66),
  error_message text,
  received_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  decided_at timestamp with time zone,
  executed_at timestamp with time zone
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_broadcasts_strategy ON trade_broadcasts(strategy_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_generator ON trade_broadcasts(alpha_generator_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_correlation ON trade_broadcasts(correlation_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_expires ON trade_broadcasts(expires_at);

CREATE INDEX IF NOT EXISTS idx_confirmations_broadcast ON protocol_trade_confirmations(trade_broadcast_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_consumer ON protocol_trade_confirmations(alpha_consumer_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_status ON protocol_trade_confirmations(status);
CREATE INDEX IF NOT EXISTS idx_confirmations_received ON protocol_trade_confirmations(received_at);

-- Step 4: Create protocol_contracts table if it doesn't exist (needed for execution)
CREATE TABLE IF NOT EXISTS protocol_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol varchar(50) NOT NULL,
  contract_name varchar(100) NOT NULL,
  network varchar(50) NOT NULL,
  address varchar(42) NOT NULL,
  abi jsonb NOT NULL,
  version varchar(20),
  is_active boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(protocol, contract_name, network)
);

-- Step 5: Add helpful comments
COMMENT ON TABLE trade_broadcasts IS 'Trade execution broadcasts to subscribers';
COMMENT ON TABLE protocol_trade_confirmations IS 'Trade confirmations from consumers';
COMMENT ON TABLE protocol_contracts IS 'Protocol contract addresses and ABIs for execution';

COMMENT ON COLUMN trade_broadcasts.strategy_id IS 'References strategies.strategy_id (text)';
COMMENT ON COLUMN trade_broadcasts.alpha_generator_id IS 'References alpha_generators.generator_id (UUID)';
COMMENT ON COLUMN protocol_trade_confirmations.alpha_consumer_id IS 'References alpha_consumers.consumer_id (UUID)';