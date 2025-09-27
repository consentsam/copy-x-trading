/**
 * Protocol Strategy Service
 * Feature: 003-protocol-strategy-integration
 * Purpose: Service layer for strategy management API endpoints
 * Updated: Uses unified strategies table instead of protocol_strategies
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { ProtocolType, FUNCTION_SIGNATURES, getProtocolRegistry } from '../lib/protocol-contracts/registry';

export interface CreateStrategyRequest {
  alphaGeneratorId: string;  // This is now the wallet address, not UUID
  name: string;
  description: string;
  protocol: ProtocolType;
  functions: Array<{
    functionName: string;
    displayName: string;
    requiredParams: string[];
    modifiableParams: string[];
  }>;
}

export interface UpdateStrategyRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
  functions?: Array<{
    functionName: string;
    displayName: string;
    requiredParams: string[];
    modifiableParams: string[];
  }>;
}

export interface StrategyResponse {
  id: string;
  alphaGeneratorAddress: string;  // Changed from alphaGeneratorId to match existing table
  name: string;
  description: string;
  protocol: ProtocolType;
  functions: any[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ProtocolStrategyService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a new protocol strategy
   */
  async createStrategy(request: CreateStrategyRequest): Promise<StrategyResponse> {
    // Validate strategy functions
    const validation = this.validateStrategyFunctions(request.functions, request.protocol);
    if (!validation.valid) {
      throw new Error(`Invalid strategy functions: ${validation.errors.join(', ')}`);
    }

    // Check name uniqueness
    const nameExists = await this.checkNameExists(request.name);
    if (nameExists) {
      throw new Error(`Strategy name '${request.name}' already exists`);
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const id = `strat_${uuidv4()}`; // Use text ID format like existing strategies
      const now = new Date();

      // Map to existing strategies table structure
      // protocol → supported_protocols (as array)
      // functions → strategy_json
      const insertQuery = `
        INSERT INTO strategies (
          strategy_id, alpha_generator_address, strategy_name, strategy_description,
          supported_protocols, strategy_json, is_active,
          subscriber_count, total_volume,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        id,
        request.alphaGeneratorId.toLowerCase(), // Normalize address to lowercase
        request.name,
        request.description,
        JSON.stringify([request.protocol]), // Store as array in supported_protocols
        JSON.stringify({
          protocol: request.protocol,
          functions: request.functions
        }), // Store functions in strategy_json with protocol info
        true,
        0, // Initial subscriber count
        '0', // Initial total volume
        now,
        now
      ]);

      await client.query('COMMIT');

      return this.mapToResponse(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all strategies with optional filters
   */
  async getStrategies(filters?: {
    alphaGeneratorId?: string;  // This is now the wallet address
    protocol?: ProtocolType;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    strategies: StrategyResponse[];
    total: number;
  }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.alphaGeneratorId) {
      conditions.push(`alpha_generator_address = $${paramIndex++}`);
      params.push(filters.alphaGeneratorId.toLowerCase());
    }

    if (filters?.protocol) {
      // Check if protocol exists in the supported_protocols JSON array
      conditions.push(`supported_protocols::text LIKE $${paramIndex++}`);
      params.push(`%"${filters.protocol}"%`);
    }

    if (filters?.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(filters.isActive);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM strategies ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get strategies
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const query = `
      SELECT * FROM strategies
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    return {
      strategies: result.rows.map(row => this.mapToResponse(row)),
      total
    };
  }

  /**
   * Get strategy by ID
   */
  async getStrategy(strategyId: string): Promise<StrategyResponse | null> {
    const query = `SELECT * FROM strategies WHERE strategy_id = $1`;
    const result = await this.pool.query(query, [strategyId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToResponse(result.rows[0]);
  }

  /**
   * Update strategy
   */
  async updateStrategy(
    strategyId: string,
    request: UpdateStrategyRequest
  ): Promise<StrategyResponse | null> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current strategy
      const currentQuery = `SELECT * FROM strategies WHERE strategy_id = $1`;
      const currentResult = await client.query(currentQuery, [strategyId]);

      if (currentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const current = currentResult.rows[0];

      // Extract protocol from strategy_json if it exists
      const currentStrategyJson = current.strategy_json || {};
      const currentProtocol = currentStrategyJson.protocol || (current.supported_protocols && current.supported_protocols[0]);

      // Check name uniqueness if name is being changed
      if (request.name && request.name !== current.strategy_name) {
        const nameExists = await this.checkNameExists(request.name, strategyId);
        if (nameExists) {
          throw new Error(`Strategy name '${request.name}' already exists`);
        }
      }

      // Validate functions if being updated
      if (request.functions && currentProtocol) {
        const validation = this.validateStrategyFunctions(request.functions, currentProtocol);
        if (!validation.valid) {
          throw new Error(`Invalid strategy functions: ${validation.errors.join(', ')}`);
        }
      }

      // Build update query dynamically
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (request.name !== undefined) {
        updates.push(`strategy_name = $${paramIndex++}`);
        params.push(request.name);
      }

      if (request.description !== undefined) {
        updates.push(`strategy_description = $${paramIndex++}`);
        params.push(request.description);
      }

      if (request.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(request.isActive);
      }

      if (request.functions !== undefined) {
        // Update strategy_json with new functions
        const updatedStrategyJson = {
          ...currentStrategyJson,
          functions: request.functions
        };
        updates.push(`strategy_json = $${paramIndex++}`);
        params.push(JSON.stringify(updatedStrategyJson));
      }

      updates.push(`updated_at = $${paramIndex++}`);
      params.push(new Date());

      params.push(strategyId);

      const updateQuery = `
        UPDATE strategies
        SET ${updates.join(', ')}
        WHERE strategy_id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, params);

      await client.query('COMMIT');

      return this.mapToResponse(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete strategy (soft delete by setting isActive = false)
   */
  async deleteStrategy(strategyId: string): Promise<boolean> {
    const query = `
      UPDATE strategies
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE strategy_id = $1
    `;

    const result = await this.pool.query(query, [strategyId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Validate strategy functions
   */
  private validateStrategyFunctions(
    functions: any[],
    protocol: ProtocolType
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check function count (2-3 required)
    if (functions.length < 2 || functions.length > 3) {
      errors.push('Strategy must have 2-3 functions');
    }

    // Validate each function
    for (const func of functions) {
      if (!func.functionName) {
        errors.push('Function name is required');
        continue;
      }

      const signature = FUNCTION_SIGNATURES[func.functionName];

      if (!signature) {
        errors.push(`Unknown function: ${func.functionName}`);
        continue;
      }

      if (signature.protocol !== protocol) {
        errors.push(`Function ${func.functionName} is not supported by protocol ${protocol}`);
        continue;
      }

      // Check required parameters match
      const providedRequired = func.requiredParams || [];
      const expectedRequired = signature.requiredParams;

      if (JSON.stringify(providedRequired.sort()) !== JSON.stringify(expectedRequired.sort())) {
        errors.push(`Invalid required parameters for ${func.functionName}`);
      }

      // Check modifiable parameters are subset of required
      const modifiable = func.modifiableParams || [];
      for (const param of modifiable) {
        if (!signature.modifiableParams.includes(param)) {
          errors.push(`Parameter ${param} cannot be modified in ${func.functionName}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if strategy name exists
   */
  private async checkNameExists(name: string, excludeId?: string): Promise<boolean> {
    let query = `SELECT EXISTS(SELECT 1 FROM strategies WHERE LOWER(strategy_name) = LOWER($1)`;
    const params: any[] = [name];

    if (excludeId) {
      query += ` AND strategy_id != $2`;
      params.push(excludeId);
    }

    query += `)`;

    const result = await this.pool.query(query, params);
    return result.rows[0].exists;
  }

  /**
   * Map database row to response
   */
  private mapToResponse(row: any): StrategyResponse {
    // Extract protocol and functions from strategy_json
    const strategyJson = row.strategy_json || {};
    const protocol = strategyJson.protocol || (row.supported_protocols && row.supported_protocols[0]) || null;
    const functions = strategyJson.functions || [];

    return {
      // Use consistent field names matching regular strategies endpoint
      strategyId: row.strategy_id,
      strategyName: row.strategy_name,
      strategyDescription: row.strategy_description || '',
      alphaGeneratorAddress: row.alpha_generator_address,
      // Include both formats for backward compatibility
      supportedProtocols: row.supported_protocols || (protocol ? [protocol] : []),
      strategyJSON: strategyJson,
      // Additional protocol-specific fields
      protocol: protocol,
      functions: functions,
      // Metrics
      subscriberCount: row.subscriber_count || 0,
      totalVolume: row.total_volume || "0",
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export factory function - creates new instance per request
export function getProtocolStrategyService(pool: Pool): ProtocolStrategyService {
  return new ProtocolStrategyService(pool);
}