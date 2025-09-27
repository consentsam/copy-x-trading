#!/usr/bin/env bun
/**
 * Seed Script for Protocol Contracts
 * Feature: 003-protocol-strategy-integration
 * Purpose: Seeds initial protocol contract configurations for AAVE and Uniswap
 * Usage: bun run scripts/seed-protocol-contracts.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// AAVE Pool ABI (simplified - supply and withdraw functions)
const AAVE_POOL_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "address", "name": "onBehalfOf", "type": "address" },
      { "internalType": "uint16", "name": "referralCode", "type": "uint16" }
    ],
    "name": "supply",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "address", "name": "to", "type": "address" }
    ],
    "name": "withdraw",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "interestRateMode", "type": "uint256" },
      { "internalType": "uint16", "name": "referralCode", "type": "uint16" },
      { "internalType": "address", "name": "onBehalfOf", "type": "address" }
    ],
    "name": "borrow",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Uniswap V3 SwapRouter ABI (simplified - exactInputSingle and exactOutputSingle)
const UNISWAP_ROUTER_ABI = [
  {
    "inputs": [{
      "components": [
        { "internalType": "address", "name": "tokenIn", "type": "address" },
        { "internalType": "address", "name": "tokenOut", "type": "address" },
        { "internalType": "uint24", "name": "fee", "type": "uint24" },
        { "internalType": "address", "name": "recipient", "type": "address" },
        { "internalType": "uint256", "name": "deadline", "type": "uint256" },
        { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
        { "internalType": "uint256", "name": "amountOutMinimum", "type": "uint256" },
        { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
      ],
      "internalType": "struct ISwapRouter.ExactInputSingleParams",
      "name": "params",
      "type": "tuple"
    }],
    "name": "exactInputSingle",
    "outputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{
      "components": [
        { "internalType": "address", "name": "tokenIn", "type": "address" },
        { "internalType": "address", "name": "tokenOut", "type": "address" },
        { "internalType": "uint24", "name": "fee", "type": "uint24" },
        { "internalType": "address", "name": "recipient", "type": "address" },
        { "internalType": "uint256", "name": "deadline", "type": "uint256" },
        { "internalType": "uint256", "name": "amountOut", "type": "uint256" },
        { "internalType": "uint256", "name": "amountInMaximum", "type": "uint256" },
        { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
      ],
      "internalType": "struct ISwapRouter.ExactOutputSingleParams",
      "name": "params",
      "type": "tuple"
    }],
    "name": "exactOutputSingle",
    "outputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  }
];

// Protocol contract configurations
const protocolContracts = [
  // AAVE Protocol - Mainnet
  {
    protocol: 'AAVE',
    contract_name: 'Pool',
    network: 'mainnet',
    address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    abi: JSON.stringify(AAVE_POOL_ABI),
    version: '3.0.0',
    is_active: true
  },
  // AAVE Protocol - Localhost (Anvil)
  {
    protocol: 'AAVE',
    contract_name: 'Pool',
    network: 'localhost',
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Example address - update after deployment
    abi: JSON.stringify(AAVE_POOL_ABI),
    version: '3.0.0',
    is_active: true
  },
  // Uniswap V3 - Mainnet
  {
    protocol: 'UNISWAP',
    contract_name: 'SwapRouter',
    network: 'mainnet',
    address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    abi: JSON.stringify(UNISWAP_ROUTER_ABI),
    version: '3.0.0',
    is_active: true
  },
  // Uniswap V3 - Localhost (Anvil)
  {
    protocol: 'UNISWAP',
    contract_name: 'SwapRouter',
    network: 'localhost',
    address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // Example address - update after deployment
    abi: JSON.stringify(UNISWAP_ROUTER_ABI),
    version: '3.0.0',
    is_active: true
  }
];

async function seedProtocolContracts() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🚀 Starting protocol contracts seed...');

    // Begin transaction
    await pool.query('BEGIN');

    // Clear existing protocol contracts (optional - comment out if you want to preserve existing)
    await pool.query('DELETE FROM protocol_contracts');
    console.log('🗑️  Cleared existing protocol contracts');

    // Insert protocol contracts
    for (const contract of protocolContracts) {
      const query = `
        INSERT INTO protocol_contracts (
          protocol, contract_name, network, address, abi, version, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (protocol, contract_name, network)
        DO UPDATE SET
          address = EXCLUDED.address,
          abi = EXCLUDED.abi,
          version = EXCLUDED.version,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP
      `;

      await pool.query(query, [
        contract.protocol,
        contract.contract_name,
        contract.network,
        contract.address,
        contract.abi,
        contract.version,
        contract.is_active
      ]);

      console.log(`✅ Seeded ${contract.protocol} ${contract.contract_name} on ${contract.network}`);
    }

    // Seed sample strategies for testing
    const sampleStrategies = [
      {
        alpha_generator_id: '00000000-0000-0000-0000-000000000001', // Replace with actual generator ID
        name: 'AAVE USDC Yield Strategy',
        description: 'Supply and withdraw USDC on AAVE for yield generation',
        protocol: 'AAVE',
        functions: JSON.stringify([
          {
            functionName: 'supply',
            displayName: 'Supply USDC',
            requiredParams: ['asset', 'amount', 'onBehalfOf', 'referralCode'],
            modifiableParams: ['amount']
          },
          {
            functionName: 'withdraw',
            displayName: 'Withdraw USDC',
            requiredParams: ['asset', 'amount', 'to'],
            modifiableParams: ['amount']
          }
        ]),
        is_active: true
      },
      {
        alpha_generator_id: '00000000-0000-0000-0000-000000000001', // Replace with actual generator ID
        name: 'Uniswap ETH-USDC Swap',
        description: 'Swap between ETH and USDC using Uniswap V3',
        protocol: 'UNISWAP',
        functions: JSON.stringify([
          {
            functionName: 'exactInputSingle',
            displayName: 'Swap Exact Input',
            requiredParams: ['tokenIn', 'tokenOut', 'fee', 'recipient', 'deadline', 'amountIn', 'amountOutMinimum', 'sqrtPriceLimitX96'],
            modifiableParams: ['amountIn', 'amountOutMinimum']
          },
          {
            functionName: 'exactOutputSingle',
            displayName: 'Swap Exact Output',
            requiredParams: ['tokenIn', 'tokenOut', 'fee', 'recipient', 'deadline', 'amountOut', 'amountInMaximum', 'sqrtPriceLimitX96'],
            modifiableParams: ['amountOut', 'amountInMaximum']
          }
        ]),
        is_active: true
      }
    ];

    // Check if alpha_generators table has any data
    const generatorCheck = await pool.query('SELECT generator_id FROM alpha_generators LIMIT 1');

    if (generatorCheck.rows.length > 0) {
      // Use actual generator ID
      const generatorId = generatorCheck.rows[0].generator_id;

      for (const strategy of sampleStrategies) {
        strategy.alpha_generator_id = generatorId;

        // Get generator's wallet address
        const generatorQuery = await pool.query(
          'SELECT generator_address FROM alpha_generators WHERE generator_id = $1',
          [generatorId]
        );
        const generatorAddress = generatorQuery.rows[0]?.generator_address || '0x0000000000000000000000000000000000000000';

        const query = `
          INSERT INTO strategies (
            strategy_id, alpha_generator_address, strategy_name, strategy_description,
            protocol, supported_protocols, functions, strategy_json,
            is_active, subscriber_count, total_volume
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (strategy_name) DO NOTHING
        `;

        const strategyId = `seed_${strategy.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

        await pool.query(query, [
          strategyId,
          generatorAddress.toLowerCase(),
          strategy.name,
          strategy.description,
          strategy.protocol,
          JSON.stringify([strategy.protocol]), // supported_protocols as array
          strategy.functions, // functions column
          JSON.stringify({ // strategy_json with full data
            protocol: strategy.protocol,
            functions: JSON.parse(strategy.functions)
          }),
          strategy.is_active,
          0, // subscriber_count
          '0' // total_volume
        ]);

        console.log(`✅ Seeded strategy: ${strategy.name}`);
      }
    } else {
      console.log('⚠️  No alpha generators found, skipping sample strategies');
    }

    // Commit transaction
    await pool.query('COMMIT');

    // Verify seed
    const contractCount = await pool.query('SELECT COUNT(*) FROM protocol_contracts');
    const strategyCount = await pool.query('SELECT COUNT(*) FROM strategies WHERE strategy_id LIKE \'seed_%\'');

    console.log('\n📊 Seed Summary:');
    console.log(`   - Protocol contracts: ${contractCount.rows[0].count}`);
    console.log(`   - Sample strategies: ${strategyCount.rows[0].count}`);
    console.log('\n✅ Protocol contracts seed completed successfully!');

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error seeding protocol contracts:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the seed
seedProtocolContracts();