#!/usr/bin/env bun
/**
 * Protocol Strategies CLI
 * Feature: 003-protocol-strategy-integration
 * Usage: bun run strategies:cli [command] [options]
 */

import { program } from 'commander';
import { Pool } from 'pg';
import chalk from 'chalk';
import Table from 'cli-table3';
import { createProtocolStrategiesLib } from './index';
import { CreateStrategyInput, UpdateStrategyInput, StrategyFilter } from './types';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../../.env.local') });

// Create database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Create strategies library instance
const strategiesLib = createProtocolStrategiesLib(pool);

// Configure CLI
program
  .name('strategies:cli')
  .description('Protocol Strategies Management CLI')
  .version('1.0.0');

// Create strategy command
program
  .command('create')
  .description('Create a new protocol strategy')
  .requiredOption('-g, --generator-id <id>', 'AlphaGenerator ID')
  .requiredOption('-n, --name <name>', 'Strategy name (must be globally unique)')
  .requiredOption('-d, --description <desc>', 'Strategy description')
  .requiredOption('-p, --protocol <protocol>', 'Protocol (AAVE or UNISWAP)')
  .requiredOption('-f, --functions <functions>', 'Comma-separated function names')
  .action(async (options) => {
    try {
      const functions = options.functions.split(',').map((f: string) => f.trim());

      const input: CreateStrategyInput = {
        alphaGeneratorId: options.generatorId,
        name: options.name,
        description: options.description,
        protocol: options.protocol.toUpperCase(),
        functions
      };

      const strategy = await strategiesLib.createStrategy(input);

      console.log(chalk.green('✅ Strategy created successfully!'));
      console.log(chalk.cyan('\nStrategy Details:'));
      console.log(`  ID: ${strategy.id}`);
      console.log(`  Name: ${strategy.name}`);
      console.log(`  Protocol: ${strategy.protocol}`);
      console.log(`  Functions: ${strategy.functions.map(f => f.displayName).join(', ')}`);

      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('❌ Error creating strategy:'), error.message);
      process.exit(1);
    }
  });

// List strategies command
program
  .command('list')
  .description('List protocol strategies')
  .option('-g, --generator-id <id>', 'Filter by AlphaGenerator ID')
  .option('-p, --protocol <protocol>', 'Filter by protocol')
  .option('-a, --active', 'Show only active strategies')
  .option('-s, --search <term>', 'Search in name and description')
  .action(async (options) => {
    try {
      const filter: StrategyFilter = {};

      if (options.generatorId) filter.alphaGeneratorId = options.generatorId;
      if (options.protocol) filter.protocol = options.protocol.toUpperCase();
      if (options.active) filter.isActive = true;
      if (options.search) filter.search = options.search;

      const strategies = await strategiesLib.getStrategies(filter);

      if (strategies.length === 0) {
        console.log(chalk.yellow('No strategies found'));
        process.exit(0);
      }

      const table = new Table({
        head: ['ID', 'Name', 'Protocol', 'Functions', 'Active', 'Created'],
        colWidths: [38, 30, 10, 40, 8, 20]
      });

      for (const strategy of strategies) {
        table.push([
          strategy.id,
          strategy.name,
          strategy.protocol,
          strategy.functions.map(f => f.functionName).join(', '),
          strategy.isActive ? '✅' : '❌',
          new Date(strategy.createdAt).toLocaleString()
        ]);
      }

      console.log(chalk.cyan(`\nFound ${strategies.length} strategies:\n`));
      console.log(table.toString());

      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('❌ Error listing strategies:'), error.message);
      process.exit(1);
    }
  });

// Get single strategy command
program
  .command('get <strategyId>')
  .description('Get details of a specific strategy')
  .action(async (strategyId) => {
    try {
      const strategy = await strategiesLib.getStrategy(strategyId);

      if (!strategy) {
        console.log(chalk.yellow(`Strategy ${strategyId} not found`));
        process.exit(0);
      }

      console.log(chalk.cyan('\nStrategy Details:'));
      console.log(chalk.white('─'.repeat(60)));
      console.log(`ID:             ${strategy.id}`);
      console.log(`Name:           ${strategy.name}`);
      console.log(`Description:    ${strategy.description}`);
      console.log(`Protocol:       ${strategy.protocol}`);
      console.log(`Generator ID:   ${strategy.alphaGeneratorId}`);
      console.log(`Active:         ${strategy.isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`Created:        ${new Date(strategy.createdAt).toLocaleString()}`);
      console.log(`Updated:        ${new Date(strategy.updatedAt).toLocaleString()}`);

      console.log(chalk.cyan('\nFunctions:'));
      for (const func of strategy.functions) {
        console.log(`  • ${func.displayName} (${func.functionName})`);
        console.log(`    Required: ${func.requiredParams.join(', ')}`);
        console.log(`    Modifiable: ${func.modifiableParams.join(', ')}`);
      }

      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('❌ Error getting strategy:'), error.message);
      process.exit(1);
    }
  });

// Update strategy command
program
  .command('update <strategyId>')
  .description('Update an existing strategy')
  .option('-n, --name <name>', 'New strategy name')
  .option('-d, --description <desc>', 'New description')
  .option('-f, --functions <functions>', 'New comma-separated function names')
  .option('--activate', 'Activate the strategy')
  .option('--deactivate', 'Deactivate the strategy')
  .action(async (strategyId, options) => {
    try {
      const input: UpdateStrategyInput = {};

      if (options.name) input.name = options.name;
      if (options.description) input.description = options.description;
      if (options.functions) {
        input.functions = options.functions.split(',').map((f: string) => f.trim());
      }
      if (options.activate) input.isActive = true;
      if (options.deactivate) input.isActive = false;

      const strategy = await strategiesLib.updateStrategy(strategyId, input);

      console.log(chalk.green('✅ Strategy updated successfully!'));
      console.log(chalk.cyan('\nUpdated Details:'));
      console.log(`  Name: ${strategy.name}`);
      console.log(`  Active: ${strategy.isActive ? '✅' : '❌'}`);
      console.log(`  Functions: ${strategy.functions.map(f => f.displayName).join(', ')}`);

      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('❌ Error updating strategy:'), error.message);
      process.exit(1);
    }
  });

// Delete strategy command
program
  .command('delete <strategyId>')
  .description('Delete a strategy (cannot have existing broadcasts)')
  .option('-f, --force', 'Skip confirmation')
  .action(async (strategyId, options) => {
    try {
      if (!options.force) {
        console.log(chalk.yellow('⚠️  This will permanently delete the strategy.'));
        console.log('Use --force flag to skip this confirmation.');
        process.exit(0);
      }

      const deleted = await strategiesLib.deleteStrategy(strategyId);

      if (deleted) {
        console.log(chalk.green('✅ Strategy deleted successfully!'));
      } else {
        console.log(chalk.yellow('Strategy not found'));
      }

      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('❌ Error deleting strategy:'), error.message);
      process.exit(1);
    }
  });

// Check name availability command
program
  .command('check-name <name>')
  .description('Check if a strategy name is available')
  .action(async (name) => {
    try {
      const available = await strategiesLib.isStrategyNameAvailable(name);

      if (available) {
        console.log(chalk.green(`✅ Name "${name}" is available!`));
      } else {
        console.log(chalk.red(`❌ Name "${name}" is already taken`));
      }

      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('❌ Error checking name:'), error.message);
      process.exit(1);
    }
  });

// Statistics command
program
  .command('stats')
  .description('Show strategy statistics')
  .option('-g, --generator-id <id>', 'Show stats for specific generator')
  .action(async (options) => {
    try {
      const stats = await strategiesLib.getStrategyStats(options.generatorId);

      console.log(chalk.cyan('\nStrategy Statistics:'));
      console.log(chalk.white('─'.repeat(40)));
      console.log(`Total Strategies:   ${stats.totalStrategies}`);
      console.log(`Active Strategies:  ${stats.activeStrategies}`);

      console.log(chalk.cyan('\nBy Protocol:'));
      for (const [protocol, count] of Object.entries(stats.strategiesByProtocol)) {
        console.log(`  ${protocol}: ${count}`);
      }

      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('❌ Error getting stats:'), error.message);
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}