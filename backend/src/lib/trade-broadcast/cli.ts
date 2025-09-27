#!/usr/bin/env node
/**
 * Trade Broadcast CLI
 * Feature: 003-protocol-strategy-integration
 * Purpose: Command-line interface for testing trade broadcasting
 */

import { Command } from 'commander';
import { Pool } from 'pg';
import { getTradeBroadcastService } from './index';
import { BroadcastRequest } from './types';
import * as dotenv from 'dotenv';
import path from 'path';
import { ProtocolType } from '../protocol-contracts/registry';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const program = new Command();

// Create database connection
function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL
  });
}

// Format table for display
function formatTable(data: any[]): void {
  if (data.length === 0) {
    console.log('No data to display');
    return;
  }

  console.table(data);
}

program
  .name('broadcast-cli')
  .description('Trade Broadcast CLI for testing trade propagation')
  .version('1.0.0');

// Send broadcast command
program
  .command('send')
  .description('Send a trade broadcast to subscribers')
  .requiredOption('-s, --strategy <id>', 'Strategy ID')
  .requiredOption('-g, --generator <id>', 'AlphaGenerator ID')
  .requiredOption('-f, --function <name>', 'Function name')
  .requiredOption('-p, --protocol <protocol>', 'Protocol (AAVE or UNISWAP)')
  .option('--params <params>', 'JSON parameters', '{}')
  .option('--gas <estimate>', 'Gas estimate in wei', '500000')
  .option('-n, --network <network>', 'Network', 'localhost')
  .option('-e, --expiry <minutes>', 'Expiry time in minutes', '5')
  .action(async (options) => {
    const pool = createPool();

    try {
      const service = getTradeBroadcastService(pool);

      const request: BroadcastRequest = {
        strategyId: options.strategy,
        alphaGeneratorId: options.generator,
        functionName: options.function,
        protocol: options.protocol as ProtocolType,
        parameters: JSON.parse(options.params),
        gasEstimate: options.gas,
        network: options.network,
        expiryMinutes: parseInt(options.expiry)
      };

      console.log('📡 Broadcasting trade...');
      const response = await service.broadcast(request);

      console.log('✅ Broadcast sent successfully!');
      console.log(`  Broadcast ID: ${response.broadcastId}`);
      console.log(`  Correlation ID: ${response.correlationId}`);
      console.log(`  Recipients: ${response.recipientCount}`);
      console.log(`  Broadcast At: ${response.broadcastAt.toISOString()}`);
      console.log(`  Expires At: ${response.expiresAt.toISOString()}`);
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Get pending trades command
program
  .command('pending')
  .description('Get pending trades for a consumer')
  .requiredOption('-c, --consumer <id>', 'AlphaConsumer ID')
  .action(async (options) => {
    const pool = createPool();

    try {
      const service = getTradeBroadcastService(pool);
      const trades = await service.getPendingTrades(options.consumer);

      if (trades.length === 0) {
        console.log('No pending trades');
      } else {
        console.log(`📋 Found ${trades.length} pending trades:`);
        formatTable(trades.map(trade => ({
          ID: trade.id.substring(0, 8),
          Status: trade.status,
          Received: trade.receivedAt,
          Parameters: JSON.stringify(trade.originalParameters).substring(0, 50) + '...'
        })));
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Accept trade command
program
  .command('accept')
  .description('Accept a trade confirmation')
  .requiredOption('-i, --id <id>', 'Trade confirmation ID')
  .option('--params <params>', 'Modified parameters JSON')
  .action(async (options) => {
    const pool = createPool();

    try {
      const service = getTradeBroadcastService(pool);
      const modifiedParams = options.params ? JSON.parse(options.params) : undefined;

      const success = await service.acceptTrade(options.id, modifiedParams);

      if (success) {
        console.log('✅ Trade accepted successfully!');
      } else {
        console.error('❌ Failed to accept trade (may not be pending)');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Reject trade command
program
  .command('reject')
  .description('Reject a trade confirmation')
  .requiredOption('-i, --id <id>', 'Trade confirmation ID')
  .action(async (options) => {
    const pool = createPool();

    try {
      const service = getTradeBroadcastService(pool);
      const success = await service.rejectTrade(options.id);

      if (success) {
        console.log('✅ Trade rejected successfully!');
      } else {
        console.error('❌ Failed to reject trade (may not be pending)');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Statistics command
program
  .command('stats')
  .description('Get broadcast statistics')
  .option('-g, --generator <id>', 'Filter by AlphaGenerator ID')
  .action(async (options) => {
    const pool = createPool();

    try {
      const service = getTradeBroadcastService(pool);
      const stats = await service.getStatistics(options.generator);

      console.log('📊 Broadcast Statistics:');
      console.log(`  Total Broadcasts: ${stats.totalBroadcasts}`);
      console.log(`  Active Broadcasts: ${stats.activeBroadcasts}`);
      console.log(`  Expired Broadcasts: ${stats.expiredBroadcasts}`);
      console.log(`  Average Recipients: ${stats.averageRecipients.toFixed(2)}`);
      console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// History command
program
  .command('history')
  .description('Get broadcast history for an AlphaGenerator')
  .requiredOption('-g, --generator <id>', 'AlphaGenerator ID')
  .option('-l, --limit <number>', 'Number of records', '20')
  .action(async (options) => {
    const pool = createPool();

    try {
      const service = getTradeBroadcastService(pool);
      const history = await service.getBroadcastHistory(
        options.generator,
        parseInt(options.limit)
      );

      if (history.length === 0) {
        console.log('No broadcast history');
      } else {
        console.log(`📜 Broadcast History (Last ${options.limit} records):`);
        formatTable(history.map(broadcast => ({
          ID: broadcast.id.substring(0, 8),
          Strategy: broadcast.strategy_name,
          Function: broadcast.function_name,
          Recipients: broadcast.recipient_count,
          Executed: broadcast.executed_count,
          BroadcastAt: broadcast.broadcast_at
        })));
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean up expired broadcasts')
  .action(async () => {
    const pool = createPool();

    try {
      const service = getTradeBroadcastService(pool);
      const count = await service.cleanupExpired();

      console.log(`🧹 Cleaned up ${count} expired broadcasts`);
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Mark executing command
program
  .command('executing')
  .description('Mark a trade as executing')
  .requiredOption('-i, --id <id>', 'Trade confirmation ID')
  .action(async (options) => {
    const pool = createPool();

    try {
      const service = getTradeBroadcastService(pool);
      const success = await service.markTradeExecuting(options.id);

      if (success) {
        console.log('✅ Trade marked as executing!');
      } else {
        console.error('❌ Failed to mark trade as executing');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Mark executed command
program
  .command('executed')
  .description('Mark a trade as executed')
  .requiredOption('-i, --id <id>', 'Trade confirmation ID')
  .requiredOption('-t, --tx <hash>', 'Transaction hash')
  .option('--gas <price>', 'Gas price in wei', '20000000000')
  .action(async (options) => {
    const pool = createPool();

    try {
      const service = getTradeBroadcastService(pool);
      const success = await service.markTradeExecuted(
        options.id,
        options.tx,
        options.gas
      );

      if (success) {
        console.log('✅ Trade marked as executed!');
      } else {
        console.error('❌ Failed to mark trade as executed');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

// Mark failed command
program
  .command('failed')
  .description('Mark a trade as failed')
  .requiredOption('-i, --id <id>', 'Trade confirmation ID')
  .requiredOption('-e, --error <message>', 'Error message')
  .action(async (options) => {
    const pool = createPool();

    try {
      const service = getTradeBroadcastService(pool);
      const success = await service.markTradeFailed(options.id, options.error);

      if (success) {
        console.log('✅ Trade marked as failed!');
      } else {
        console.error('❌ Failed to mark trade as failed');
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  });

program.parse(process.argv);