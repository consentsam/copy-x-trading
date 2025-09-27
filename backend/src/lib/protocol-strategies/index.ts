/**
 * Protocol Strategies Library
 * Feature: 003-protocol-strategy-integration
 * Purpose: Core library for managing DeFi protocol strategies
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  Strategy,
  CreateStrategyInput,
  UpdateStrategyInput,
  StrategyFilter,
  StrategyStats,
  ProtocolType,
  StrategyFunction
} from './types';
import { FUNCTION_SIGNATURES } from '../protocol-contracts/registry';

export class ProtocolStrategiesLib {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a new strategy
   */
  async createStrategy(input: CreateStrategyInput): Promise<Strategy> {
    // Validate input
    if (input.functions.length < 2 || input.functions.length > 3) {
      throw new Error('Strategy must have 2-3 functions');
    }

    // Check name uniqueness globally
    const nameCheck = await this.pool.query(
      'SELECT strategy_id FROM strategies WHERE LOWER(strategy_name) = LOWER($1)',
      [input.name]
    );

    if (nameCheck.rows.length > 0) {
      throw new Error(`Strategy name "${input.name}" already exists globally`);
    }

    // Validate and build function objects
    const functionObjects: StrategyFunction[] = input.functions.map(fnName => {
      const signature = FUNCTION_SIGNATURES[fnName];
      if (!signature) {
        throw new Error(`Unknown function: ${fnName}`);
      }
      if (signature.protocol !== input.protocol) {
        throw new Error(`Function ${fnName} is not available for protocol ${input.protocol}`);
      }
      return {
        functionName: signature.name,
        displayName: signature.displayName,
        requiredParams: signature.requiredParams,
        modifiableParams: signature.modifiableParams
      };
    });

    // Insert strategy into unified table
    // Map: protocol → supported_protocols (as array)
    // Map: functions → strategy_json (with protocol info)
    const query = `
      INSERT INTO strategies (
        strategy_id, alpha_generator_address, strategy_name, strategy_description,
        supported_protocols, strategy_json, is_active, subscriber_count, total_volume,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *
    `;

    const id = `proto_${uuidv4()}`; // Use text ID with prefix
    const result = await this.pool.query(query, [
      id,
      input.alphaGeneratorId.toLowerCase(), // Expect wallet address now
      input.name,
      input.description,
      JSON.stringify([input.protocol]), // Store as array in supported_protocols
      JSON.stringify({
        protocol: input.protocol,
        functions: functionObjects
      }), // Store functions with protocol info in strategy_json
      true,
      0, // Initial subscriber count
      '0' // Initial volume
    ]);

    return this.mapRowToStrategy(result.rows[0]);
  }

  /**
   * Update an existing strategy
   */
  async updateStrategy(
    strategyId: string,
    input: UpdateStrategyInput
  ): Promise<Strategy> {
    // Check if strategy exists
    const existing = await this.getStrategy(strategyId);
    if (!existing) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    // Check name uniqueness if updating name
    if (input.name && input.name !== existing.name) {
      const nameCheck = await this.pool.query(
        'SELECT strategy_id FROM strategies WHERE LOWER(strategy_name) = LOWER($1) AND strategy_id != $2',
        [input.name, strategyId]
      );

      if (nameCheck.rows.length > 0) {
        throw new Error(`Strategy name "${input.name}" already exists`);
      }
    }

    // Build function objects if updating functions
    let functionObjects: StrategyFunction[] | undefined;
    if (input.functions) {
      if (input.functions.length < 2 || input.functions.length > 3) {
        throw new Error('Strategy must have 2-3 functions');
      }

      functionObjects = input.functions.map(fnName => {
        const signature = FUNCTION_SIGNATURES[fnName];
        if (!signature) {
          throw new Error(`Unknown function: ${fnName}`);
        }
        if (signature.protocol !== existing.protocol) {
          throw new Error(`Function ${fnName} is not available for protocol ${existing.protocol}`);
        }
        return {
          functionName: signature.name,
          displayName: signature.displayName,
          requiredParams: signature.requiredParams,
          modifiableParams: signature.modifiableParams
        };
      });
    }

    // Update strategy
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.name !== undefined) {
      updates.push(`strategy_name = $${paramCount++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`strategy_description = $${paramCount++}`);
      values.push(input.description);
    }
    if (functionObjects) {
      // Update strategy_json with new functions
      const currentJson = existing.functions ? { protocol: existing.protocol, functions: existing.functions } : {};
      updates.push(`strategy_json = $${paramCount++}`);
      values.push(JSON.stringify({
        ...currentJson,
        functions: functionObjects
      }));
    }
    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(input.isActive);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(strategyId);

    const query = `
      UPDATE strategies
      SET ${updates.join(', ')}
      WHERE strategy_id = $${paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return this.mapRowToStrategy(result.rows[0]);
  }

  /**
   * Get a single strategy by ID
   */
  async getStrategy(strategyId: string): Promise<Strategy | null> {
    const query = `
      SELECT * FROM strategies
      WHERE strategy_id = $1
    `;

    const result = await this.pool.query(query, [strategyId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToStrategy(result.rows[0]);
  }

  /**
   * Get strategies with filters
   */
  async getStrategies(filter: StrategyFilter = {}): Promise<Strategy[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (filter.alphaGeneratorId) {
      conditions.push(`alpha_generator_address = $${paramCount++}`);
      values.push(filter.alphaGeneratorId.toLowerCase());
    }

    if (filter.protocol) {
      // Check if protocol exists in the supported_protocols JSON array
      conditions.push(`supported_protocols::text LIKE $${paramCount++}`);
      values.push(`%"${filter.protocol}"%`);
    }

    if (filter.isActive !== undefined) {
      conditions.push(`is_active = $${paramCount++}`);
      values.push(filter.isActive);
    }

    if (filter.search) {
      conditions.push(`(
        LOWER(strategy_name) LIKE LOWER($${paramCount}) OR
        LOWER(strategy_description) LIKE LOWER($${paramCount})
      )`);
      values.push(`%${filter.search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const query = `
      SELECT * FROM strategies
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.mapRowToStrategy(row));
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(strategyId: string): Promise<boolean> {
    // Check if strategy has any active broadcasts
    const broadcastCheck = await this.pool.query(
      'SELECT COUNT(*) FROM trade_broadcasts WHERE strategy_id = $1',
      [strategyId]
    );

    if (parseInt(broadcastCheck.rows[0].count) > 0) {
      throw new Error('Cannot delete strategy with existing broadcasts');
    }

    const query = `
      DELETE FROM strategies
      WHERE strategy_id = $1
    `;

    const result = await this.pool.query(query, [strategyId]);
    return result.rowCount > 0;
  }

  /**
   * Get strategy statistics
   */
  async getStrategyStats(alphaGeneratorId?: string): Promise<StrategyStats> {
    let conditions = '';
    const values: any[] = [];

    if (alphaGeneratorId) {
      conditions = 'WHERE alpha_generator_address = $1';
      values.push(alphaGeneratorId.toLowerCase());
    }

    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        (supported_protocols->0)::text as protocol,
        COUNT(*) as protocol_count
      FROM strategies
      ${conditions}
      GROUP BY ROLLUP((supported_protocols->0)::text)
    `;

    const result = await this.pool.query(query, values);

    const stats: StrategyStats = {
      totalStrategies: 0,
      activeStrategies: 0,
      strategiesByProtocol: {} as Record<ProtocolType, number>
    };

    for (const row of result.rows) {
      if (row.protocol === null) {
        stats.totalStrategies = parseInt(row.total);
        stats.activeStrategies = parseInt(row.active);
      } else {
        stats.strategiesByProtocol[row.protocol as ProtocolType] = parseInt(row.protocol_count);
      }
    }

    return stats;
  }

  /**
   * Validate strategy name availability
   */
  async isStrategyNameAvailable(name: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT EXISTS(SELECT 1 FROM strategies WHERE LOWER(strategy_name) = LOWER($1))',
      [name]
    );

    return !result.rows[0].exists;
  }

  /**
   * Helper: Map database row to Strategy object
   */
  private mapRowToStrategy(row: any): Strategy {
    // Extract protocol and functions from JSON columns
    const strategyJson = row.strategy_json || {};
    const protocol = strategyJson.protocol ||
                    (row.supported_protocols && row.supported_protocols[0]) ||
                    null;
    const functions = strategyJson.functions || [];

    return {
      id: row.strategy_id,
      alphaGeneratorId: row.alpha_generator_address,
      name: row.strategy_name,
      description: row.strategy_description || '',
      protocol: protocol,
      functions: functions,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export factory function
export function createProtocolStrategiesLib(pool: Pool): ProtocolStrategiesLib {
  return new ProtocolStrategiesLib(pool);
}