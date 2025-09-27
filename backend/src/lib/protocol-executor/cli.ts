#!/usr/bin/env node
/**
 * Protocol Executor CLI
 * Feature: 003-protocol-strategy-integration
 * Purpose: Command-line interface for testing protocol execution
 */

import { Command } from 'commander';
import { Pool } from 'pg';
import { getProtocolExecutor } from './index';
import { ExecutionRequest } from './types';
import { ProtocolType } from '../protocol-contracts/registry';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const program = new Command();

// Create database connection
function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL
  });
}

program
  .name('executor-cli')
  .description('Protocol Executor CLI for testing DeFi protocol functions')
  .version('1.0.0');

// Execute command
program
  .command('execute')
  .description('Execute a protocol function')
  .requiredOption('-p, --protocol <protocol>', 'Protocol (AAVE or UNISWAP)')
  .requiredOption('-f, --function <function>', 'Function name')
  .requiredOption('-a, --address <address>', 'User address')
  .option('-n, --network <network>', 'Network', 'localhost')
  .option('--params <params>', 'JSON parameters', '{}')
  .option('--dry-run', 'Perform dry run (estimate gas only)')
  .action(async (options) => {
    const pool = createPool();

    try {
      const executor = getProtocolExecutor(pool);
      const params = JSON.parse(options.params);

      // Get contract address from registry
      const contractName = options.protocol === 'AAVE' ? 'Pool' : 'SwapRouter';
      const registry = await import('../protocol-contracts/registry');
      const protocolRegistry = registry.getProtocolRegistry(pool);
      const contract = await protocolRegistry.getContract(
        options.protocol as ProtocolType,
        contractName,
        options.network
      );

      if (!contract) {
        console.error(`❌ Contract not found for ${options.protocol} on ${options.network}`);
        process.exit(1);
      }

      const request: ExecutionRequest = {
        functionName: options.function,
        protocol: options.protocol as ProtocolType,
        parameters: params,
        contractAddress: contract.address,
        network: options.network,
        userAddress: options.address
      };

      // Validate request
      const validation = await executor.validateRequest(request);
      if (!validation.valid) {
        console.error('❌ Validation failed:', validation.errors.join(', '));
        process.exit(1);
      }

      if (options.dryRun) {
        // Estimate gas only
        console.log('🔍 Estimating gas...');
        const estimation = await executor.estimateGas(request);
        console.log('✅ Gas Estimation:');
        console.log(`  Gas Limit: ${estimation.gasLimit}`);
        console.log(`  Gas Price: ${estimation.gasPrice} wei`);
        console.log(`  Total Cost: ${estimation.totalCost} wei`);
        console.log(`  TTL: ${estimation.ttl} seconds`);
      } else {
        // Execute transaction
        console.log('🚀 Executing transaction...');
        const result = await executor.execute(request);

        if (result.status === 'success') {
          console.log('✅ Transaction successful!');
          console.log(`  Hash: ${result.transactionHash}`);
          console.log(`  Block: ${result.blockNumber}`);
          console.log(`  Gas Used: ${result.gasUsed}`);
        } else {
          console.error('❌ Transaction failed:', result.errorMessage);
          process.exit(1);
        }
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Estimate command
program
  .command('estimate')
  .description('Estimate gas for a protocol function')
  .requiredOption('-p, --protocol <protocol>', 'Protocol (AAVE or UNISWAP)')
  .requiredOption('-f, --function <function>', 'Function name')
  .requiredOption('-a, --address <address>', 'User address')
  .option('-n, --network <network>', 'Network', 'localhost')
  .option('--params <params>', 'JSON parameters', '{}')
  .action(async (options) => {
    const pool = createPool();

    try {
      const executor = getProtocolExecutor(pool);
      const params = JSON.parse(options.params);

      // Get contract address from registry
      const contractName = options.protocol === 'AAVE' ? 'Pool' : 'SwapRouter';
      const registry = await import('../protocol-contracts/registry');
      const protocolRegistry = registry.getProtocolRegistry(pool);
      const contract = await protocolRegistry.getContract(
        options.protocol as ProtocolType,
        contractName,
        options.network
      );

      if (!contract) {
        console.error(`❌ Contract not found for ${options.protocol} on ${options.network}`);
        process.exit(1);
      }

      const request: ExecutionRequest = {
        functionName: options.function,
        protocol: options.protocol as ProtocolType,
        parameters: params,
        contractAddress: contract.address,
        network: options.network,
        userAddress: options.address
      };

      console.log('🔍 Estimating gas...');
      const estimation = await executor.estimateGas(request);

      console.log('✅ Gas Estimation:');
      console.log(`  Gas Limit: ${estimation.gasLimit}`);
      console.log(`  Gas Price: ${estimation.gasPrice} wei`);
      console.log(`  Total Cost: ${estimation.totalCost} wei`);
      console.log(`  Estimated At: ${estimation.estimatedAt.toISOString()}`);
      console.log(`  Cache TTL: ${estimation.ttl} seconds`);

      // Convert to ETH for readability
      const ethCost = Number(estimation.totalCost) / 1e18;
      console.log(`  Total Cost (ETH): ${ethCost.toFixed(6)} ETH`);
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Execute strategy command
program
  .command('execute-strategy')
  .description('Execute a complete strategy')
  .requiredOption('-s, --strategy <id>', 'Strategy ID')
  .requiredOption('-a, --address <address>', 'User address')
  .option('-n, --network <network>', 'Network', 'localhost')
  .option('--functions <functions>', 'JSON array of functions', '[]')
  .action(async (options) => {
    const pool = createPool();

    try {
      const executor = getProtocolExecutor(pool);
      const functions = JSON.parse(options.functions);

      if (functions.length === 0) {
        console.error('❌ No functions provided');
        process.exit(1);
      }

      console.log(`🚀 Executing strategy ${options.strategy}...`);
      const result = await executor.executeStrategy(
        options.strategy,
        functions,
        options.address,
        options.network
      );

      if (result.success) {
        console.log('✅ Strategy executed successfully!');
        console.log(`  Total Gas Used: ${result.totalGasUsed}`);
        console.log(`  Executions:`);
        result.executions.forEach((exec, i) => {
          console.log(`    ${i + 1}. ${exec.status === 'success' ? '✅' : '❌'} TX: ${exec.transactionHash || 'N/A'}`);
        });
      } else {
        console.error('❌ Strategy execution failed');
        result.executions.forEach((exec, i) => {
          if (exec.status === 'failed') {
            console.error(`  ${i + 1}. Error: ${exec.errorMessage}`);
          }
        });
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate an execution request')
  .requiredOption('-p, --protocol <protocol>', 'Protocol (AAVE or UNISWAP)')
  .requiredOption('-f, --function <function>', 'Function name')
  .requiredOption('-a, --address <address>', 'User address')
  .option('-n, --network <network>', 'Network', 'localhost')
  .option('--params <params>', 'JSON parameters', '{}')
  .action(async (options) => {
    const pool = createPool();

    try {
      const executor = getProtocolExecutor(pool);
      const params = JSON.parse(options.params);

      // Get contract address from registry
      const contractName = options.protocol === 'AAVE' ? 'Pool' : 'SwapRouter';
      const registry = await import('../protocol-contracts/registry');
      const protocolRegistry = registry.getProtocolRegistry(pool);
      const contract = await protocolRegistry.getContract(
        options.protocol as ProtocolType,
        contractName,
        options.network
      );

      if (!contract) {
        console.error(`❌ Contract not found for ${options.protocol} on ${options.network}`);
        process.exit(1);
      }

      const request: ExecutionRequest = {
        functionName: options.function,
        protocol: options.protocol as ProtocolType,
        parameters: params,
        contractAddress: contract.address,
        network: options.network,
        userAddress: options.address
      };

      console.log('🔍 Validating request...');
      const validation = await executor.validateRequest(request);

      if (validation.valid) {
        console.log('✅ Request is valid!');
      } else {
        console.error('❌ Validation failed:');
        validation.errors.forEach(error => {
          console.error(`  - ${error}`);
        });
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// List supported functions
program
  .command('list-functions')
  .description('List all supported protocol functions')
  .option('-p, --protocol <protocol>', 'Filter by protocol')
  .action(async () => {
    const registry = await import('../protocol-contracts/registry');
    const functions = registry.FUNCTION_SIGNATURES;

    console.log('📋 Supported Protocol Functions:\n');

    Object.entries(functions).forEach(([name, sig]) => {
      if (!program.opts().protocol || sig.protocol === program.opts().protocol) {
        console.log(`${sig.protocol} - ${name} (${sig.displayName})`);
        console.log(`  Required: ${sig.requiredParams.join(', ')}`);
        console.log(`  Modifiable: ${sig.modifiableParams.join(', ')}\n`);
      }
    });
  });

program.parse(process.argv);