-- Migrate protocol_strategies data to strategies table
-- This allows the existing API endpoints to work without modification
-- Date: 2025-09-27

-- First, clear any existing test data from strategies table to avoid conflicts
DELETE FROM strategies WHERE strategy_id IN (
  '8920d717-4d49-40ec-9168-e43041cb3859',
  '4f03d56f-463d-40c5-8f9c-8f69268fdfd5',
  '3f3812a9-d9a5-4fe0-8af1-96fd5eee8017'
);

-- Insert protocol_strategies data into strategies table with proper column mapping
INSERT INTO strategies (
  strategy_id,
  strategy_name,
  strategy_description,
  supported_protocols,
  strategy_json,
  alpha_generator_address,
  subscriber_count,
  total_volume,
  is_active,
  created_at,
  updated_at
)
SELECT
  ps.id::text AS strategy_id,
  ps.name AS strategy_name,
  ps.description AS strategy_description,
  to_jsonb(ARRAY[ps.protocol]) AS supported_protocols,
  ps.functions AS strategy_json,
  LOWER(ag.generator_address) AS alpha_generator_address,
  COALESCE(
    (SELECT COUNT(*)::integer FROM subscriptions
     WHERE alpha_generator_address = LOWER(ag.generator_address)
     AND is_active = true), 0
  ) AS subscriber_count,
  '0'::numeric(78,0) AS total_volume,
  ps.is_active,
  ps.created_at,
  ps.updated_at
FROM protocol_strategies ps
LEFT JOIN alpha_generators ag ON ps.alpha_generator_id = ag.generator_id
ON CONFLICT (strategy_id) DO UPDATE SET
  strategy_name = EXCLUDED.strategy_name,
  strategy_description = EXCLUDED.strategy_description,
  supported_protocols = EXCLUDED.supported_protocols,
  strategy_json = EXCLUDED.strategy_json,
  alpha_generator_address = EXCLUDED.alpha_generator_address,
  subscriber_count = EXCLUDED.subscriber_count,
  is_active = EXCLUDED.is_active,
  updated_at = EXCLUDED.updated_at;

-- Verify the data was migrated
SELECT
  strategy_id,
  strategy_name,
  alpha_generator_address,
  supported_protocols,
  is_active
FROM strategies
WHERE strategy_id IN (
  '8920d717-4d49-40ec-9168-e43041cb3859',
  '4f03d56f-463d-40c5-8f9c-8f69268fdfd5',
  '3f3812a9-d9a5-4fe0-8af1-96fd5eee8017'
);