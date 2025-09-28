/**
 * Trade Confirmation Service
 * Feature: 003-protocol-strategy-integration
 * Purpose: Service layer for trade confirmation management
 */

import { Pool } from 'pg';
import { getTradeBroadcastService } from '../lib/trade-broadcast';
import { getSSEBroadcastService } from './sse-broadcast-service';
import { FUNCTION_SIGNATURES } from '../lib/protocol-contracts/registry';

export interface ConfirmationListRequest {
  consumerId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ConfirmationUpdateRequest {
  confirmationId: string;
  action: 'accept' | 'reject';
  modifiedParameters?: Record<string, any>;
  consumerId: string;
}

export interface ConfirmationResponse {
  id: string;
  tradeBroadcastId: string;
  alphaConsumerId: string;
  originalParameters: Record<string, any>;
  modifiedParameters: Record<string, any>;
  status: string;
  gasPrice?: string;
  transactionHash?: string;
  errorMessage?: string;
  receivedAt: Date;
  decidedAt?: Date;
  executedAt?: Date;
  // Additional fields from join
  strategyName?: string;
  functionName?: string;
  protocol?: string;
  correlationId?: string;
  expiresAt?: Date;
}

export class ConfirmationService {
  private pool: Pool;
  private broadcastService: ReturnType<typeof getTradeBroadcastService>;
  private sseService: ReturnType<typeof getSSEBroadcastService>;

  constructor(pool: Pool) {
    this.pool = pool;
    this.broadcastService = getTradeBroadcastService(pool);
    this.sseService = getSSEBroadcastService(pool);
  }

  /**
   * Get pending trade confirmations for a consumer
   */
  async getPendingConfirmations(request: ConfirmationListRequest): Promise<{
    confirmations: ConfirmationResponse[];
    total: number;
  }> {
    // First, resolve the wallet address to a consumer UUID
    let consumerUuid = request.consumerId;

    // Check if the input looks like an Ethereum address (starts with 0x and is 42 chars)
    if (request.consumerId.startsWith('0x') && request.consumerId.length === 42) {
      const consumerQuery = `
        SELECT consumer_id
        FROM alpha_consumers
        WHERE LOWER(wallet_address) = LOWER($1)
      `;
      const consumerResult = await this.pool.query(consumerQuery, [request.consumerId]);

      if (consumerResult.rows.length === 0) {
        // Consumer not found, return empty result
        return {
          confirmations: [],
          total: 0
        };
      }

      consumerUuid = consumerResult.rows[0].consumer_id;
    }

    const conditions: string[] = ['tc.alpha_consumer_id = $1'];
    const params: any[] = [consumerUuid];
    let paramIndex = 2;

    // Add status filter if provided
    if (request.status) {
      conditions.push(`tc.status = $${paramIndex++}`);
      params.push(request.status);
    } else {
      // Default to pending only
      conditions.push('tc.status = \'PENDING\'');
    }

    // Only show non-expired trades for pending status
    if (!request.status || request.status === 'PENDING') {
      conditions.push('tb.expires_at > CURRENT_TIMESTAMP');
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*)
      FROM protocol_trade_confirmations tc
      JOIN trade_broadcasts tb ON tc.trade_broadcast_id = tb.id
      WHERE ${whereClause}
    `;

    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get confirmations with details
    const limit = request.limit || 50;
    const offset = request.offset || 0;

    const query = `
      SELECT
        tc.*,
        tb.strategy_id,
        tb.function_name,
        tb.protocol,
        tb.gas_estimate,
        tb.network,
        tb.correlation_id,
        tb.expires_at,
        s.strategy_name,
        ag.name as generator_name
      FROM protocol_trade_confirmations tc
      JOIN trade_broadcasts tb ON tc.trade_broadcast_id = tb.id
      JOIN strategies s ON tb.strategy_id = s.strategy_id
      JOIN alpha_generators ag ON tb.alpha_generator_id = ag.generator_id
      WHERE ${whereClause}
      ORDER BY tc.received_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    const confirmations: ConfirmationResponse[] = result.rows.map(row => ({
      id: row.id,
      tradeBroadcastId: row.trade_broadcast_id,
      alphaConsumerId: row.alpha_consumer_id,
      originalParameters: row.original_parameters,
      modifiedParameters: row.modified_parameters,
      status: row.status,
      gasPrice: row.gas_price,
      transactionHash: row.transaction_hash,
      errorMessage: row.error_message,
      receivedAt: row.received_at,
      decidedAt: row.decided_at,
      executedAt: row.executed_at,
      strategyName: row.strategy_name,
      functionName: row.function_name,
      protocol: row.protocol,
      correlationId: row.correlation_id,
      expiresAt: row.expires_at
    }));

    return {
      confirmations,
      total
    };
  }

  /**
   * Update trade confirmation (accept/reject)
   */
  async updateConfirmation(request: ConfirmationUpdateRequest): Promise<ConfirmationResponse> {
    // Get current confirmation
    const confirmation = await this.broadcastService.getTradeConfirmation(
      request.confirmationId
    );

    if (!confirmation) {
      throw new Error('Confirmation not found');
    }

    // Resolve consumer ID if wallet address provided
    let consumerUuid = request.consumerId;

    // Check if the input looks like an Ethereum address (starts with 0x and is 42 chars)
    if (request.consumerId.startsWith('0x') && request.consumerId.length === 42) {
      const consumerQuery = `
        SELECT consumer_id
        FROM alpha_consumers
        WHERE LOWER(wallet_address) = LOWER($1)
      `;
      const consumerResult = await this.pool.query(consumerQuery, [request.consumerId]);

      if (consumerResult.rows.length === 0) {
        throw new Error('Consumer not found');
      }

      consumerUuid = consumerResult.rows[0].consumer_id;
    }

    // Verify ownership
    if (confirmation.alphaConsumerId !== consumerUuid) {
      throw new Error('Unauthorized to update this confirmation');
    }

    // Check status
    if (confirmation.status !== 'PENDING') {
      throw new Error(`Cannot update confirmation with status: ${confirmation.status}`);
    }

    // Get broadcast details for validation
    const broadcastQuery = `
      SELECT tb.*, s.protocol, s.strategy_name
      FROM trade_broadcasts tb
      JOIN strategies s ON tb.strategy_id = s.strategy_id
      WHERE tb.id = $1
    `;

    const broadcastResult = await this.pool.query(broadcastQuery, [
      confirmation.tradeBroadcastId
    ]);

    if (broadcastResult.rows.length === 0) {
      throw new Error('Trade broadcast not found');
    }

    const broadcast = broadcastResult.rows[0];

    // Check if expired
    if (new Date(broadcast.expires_at) < new Date()) {
      throw new Error('Trade broadcast has expired');
    }

    // Validate modified parameters if accepting
    if (request.action === 'accept' && request.modifiedParameters) {
      const validation = this.validateModifiedParameters(
        broadcast.function_name,
        broadcast.protocol,
        confirmation.originalParameters,
        request.modifiedParameters
      );

      if (!validation.valid) {
        throw new Error(`Invalid parameter modifications: ${validation.errors.join(', ')}`);
      }
    }

    // Update the confirmation
    const success = request.action === 'accept'
      ? await this.broadcastService.acceptTrade(
          request.confirmationId,
          request.modifiedParameters || confirmation.originalParameters
        )
      : await this.broadcastService.rejectTrade(request.confirmationId);

    if (!success) {
      throw new Error('Failed to update confirmation');
    }

    // Send SSE notification
    const updatedConfirmation = await this.broadcastService.getTradeConfirmation(
      request.confirmationId
    );

    if (updatedConfirmation) {
      await this.sseService.sendTradeConfirmation(request.consumerId, {
        ...updatedConfirmation,
        strategyName: broadcast.strategy_name,
        functionName: broadcast.function_name,
        protocol: broadcast.protocol
      });
    }

    // Return updated confirmation with details
    const resultQuery = `
      SELECT
        tc.*,
        tb.function_name,
        tb.protocol,
        tb.correlation_id,
        tb.expires_at,
        s.name as strategy_name
      FROM protocol_trade_confirmations tc
      JOIN trade_broadcasts tb ON tc.trade_broadcast_id = tb.id
      JOIN strategies s ON tb.strategy_id = s.strategy_id
      WHERE tc.id = $1
    `;

    const finalResult = await this.pool.query(resultQuery, [request.confirmationId]);

    if (finalResult.rows.length === 0) {
      throw new Error('Failed to retrieve updated confirmation');
    }

    const row = finalResult.rows[0];

    return {
      id: row.id,
      tradeBroadcastId: row.trade_broadcast_id,
      alphaConsumerId: row.alpha_consumer_id,
      originalParameters: row.original_parameters,
      modifiedParameters: row.modified_parameters,
      status: row.status,
      gasPrice: row.gas_price,
      transactionHash: row.transaction_hash,
      errorMessage: row.error_message,
      receivedAt: row.received_at,
      decidedAt: row.decided_at,
      executedAt: row.executed_at,
      strategyName: row.strategy_name,
      functionName: row.function_name,
      protocol: row.protocol,
      correlationId: row.correlation_id,
      expiresAt: row.expires_at
    };
  }

  /**
   * Validate modified parameters
   */
  private validateModifiedParameters(
    functionName: string,
    protocol: string,
    originalParams: Record<string, any>,
    modifiedParams: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Get function signature
    const signature = FUNCTION_SIGNATURES[functionName];

    if (!signature) {
      errors.push(`Unknown function: ${functionName}`);
      return { valid: false, errors };
    }

    if (signature.protocol !== protocol) {
      errors.push(`Function ${functionName} does not belong to protocol ${protocol}`);
      return { valid: false, errors };
    }

    // Check that only modifiable parameters were changed
    const modifiableParams = signature.modifiableParams;

    for (const key in modifiedParams) {
      if (!(key in originalParams)) {
        errors.push(`Parameter ${key} was not in original parameters`);
        continue;
      }

      if (originalParams[key] !== modifiedParams[key]) {
        // Parameter was modified
        if (!modifiableParams.includes(key)) {
          errors.push(`Parameter ${key} cannot be modified`);
        }
      }
    }

    // Check all required parameters are present
    for (const required of signature.requiredParams) {
      if (!(required in modifiedParams)) {
        errors.push(`Missing required parameter: ${required}`);
      }
    }

    // Validate amount parameters
    const amountFields = ['amount', 'amountIn', 'amountOut', 'amountInMaximum', 'amountOutMinimum'];
    for (const field of amountFields) {
      if (field in modifiedParams) {
        try {
          const amount = BigInt(modifiedParams[field]);
          if (amount <= 0n) {
            errors.push(`${field} must be greater than 0`);
          }
        } catch {
          errors.push(`Invalid ${field} format`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get confirmation statistics for a consumer
   */
  async getStatistics(consumerId: string): Promise<{
    totalPending: number;
    totalAccepted: number;
    totalRejected: number;
    totalExecuted: number;
    totalFailed: number;
    successRate: number;
  }> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING') as total_pending,
        COUNT(*) FILTER (WHERE status = 'ACCEPTED') as total_accepted,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as total_rejected,
        COUNT(*) FILTER (WHERE status = 'EXECUTED') as total_executed,
        COUNT(*) FILTER (WHERE status = 'FAILED') as total_failed,
        COALESCE(
          COUNT(*) FILTER (WHERE status = 'EXECUTED') * 100.0 /
          NULLIF(COUNT(*) FILTER (WHERE status IN ('EXECUTED', 'FAILED')), 0),
          0
        ) as success_rate
      FROM protocol_trade_confirmations
      WHERE alpha_consumer_id = $1
    `;

    const result = await this.pool.query(query, [consumerId]);
    const row = result.rows[0];

    return {
      totalPending: parseInt(row.total_pending) || 0,
      totalAccepted: parseInt(row.total_accepted) || 0,
      totalRejected: parseInt(row.total_rejected) || 0,
      totalExecuted: parseInt(row.total_executed) || 0,
      totalFailed: parseInt(row.total_failed) || 0,
      successRate: parseFloat(row.success_rate) || 0
    };
  }
}

// Export factory function - creates new instance per request
export function getConfirmationService(pool: Pool): ConfirmationService {
  return new ConfirmationService(pool);
}