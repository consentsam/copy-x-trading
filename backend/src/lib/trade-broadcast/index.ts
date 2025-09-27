/**
 * Trade Broadcast Main Module
 * Feature: 003-protocol-strategy-integration
 * Purpose: Central interface for trade broadcasting and confirmation management
 */

import { Pool } from 'pg';
import { TradeBroadcaster } from './broadcaster';
import {
  BroadcastRequest,
  BroadcastResponse,
  BroadcastStatistics,
  TradeConfirmation,
  TradeStatus
} from './types';

export * from './types';
export { TradeBroadcaster };

export class TradeBroadcastService {
  private broadcaster: TradeBroadcaster;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.broadcaster = new TradeBroadcaster(pool);
  }

  /**
   * Broadcast a trade to subscribers
   */
  async broadcast(request: BroadcastRequest): Promise<BroadcastResponse> {
    // Validate request
    if (!request.strategyId) {
      throw new Error('Strategy ID is required');
    }

    if (!request.functionName || !request.protocol) {
      throw new Error('Function name and protocol are required');
    }

    return this.broadcaster.broadcastTrade(request);
  }

  /**
   * Get broadcast statistics
   */
  async getStatistics(alphaGeneratorId?: string): Promise<BroadcastStatistics> {
    return this.broadcaster.getStatistics(alphaGeneratorId);
  }

  /**
   * Get pending trades for a consumer
   */
  async getPendingTrades(consumerId: string): Promise<TradeConfirmation[]> {
    const trades = await this.broadcaster.getPendingTrades(consumerId);

    return trades.map(row => ({
      id: row.id,
      tradeBroadcastId: row.trade_broadcast_id,
      alphaConsumerId: row.alpha_consumer_id,
      originalParameters: row.original_parameters,
      modifiedParameters: row.modified_parameters,
      status: row.status as TradeStatus,
      gasPrice: row.gas_price,
      transactionHash: row.transaction_hash,
      errorMessage: row.error_message,
      receivedAt: row.received_at,
      decidedAt: row.decided_at,
      executedAt: row.executed_at
    }));
  }

  /**
   * Accept a trade with optional parameter modifications
   */
  async acceptTrade(
    confirmationId: string,
    modifiedParameters?: Record<string, any>
  ): Promise<boolean> {
    return this.broadcaster.updateTradeStatus(
      confirmationId,
      'ACCEPTED',
      modifiedParameters
    );
  }

  /**
   * Reject a trade
   */
  async rejectTrade(confirmationId: string): Promise<boolean> {
    return this.broadcaster.updateTradeStatus(confirmationId, 'REJECTED');
  }

  /**
   * Register SSE client for real-time updates
   */
  registerSSEClient(consumerId: string, client: any): void {
    this.broadcaster.registerSSEClient(consumerId, client);
  }

  /**
   * Unregister SSE client
   */
  unregisterSSEClient(consumerId: string): void {
    this.broadcaster.unregisterSSEClient(consumerId);
  }

  /**
   * Cleanup expired broadcasts
   */
  async cleanupExpired(): Promise<number> {
    return this.broadcaster.cleanupExpiredBroadcasts();
  }

  /**
   * Get trade details by confirmation ID
   */
  async getTradeConfirmation(confirmationId: string): Promise<TradeConfirmation | null> {
    const query = `
      SELECT * FROM protocol_trade_confirmations
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [confirmationId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      tradeBroadcastId: row.trade_broadcast_id,
      alphaConsumerId: row.alpha_consumer_id,
      originalParameters: row.original_parameters,
      modifiedParameters: row.modified_parameters,
      status: row.status as TradeStatus,
      gasPrice: row.gas_price,
      transactionHash: row.transaction_hash,
      errorMessage: row.error_message,
      receivedAt: row.received_at,
      decidedAt: row.decided_at,
      executedAt: row.executed_at
    };
  }

  /**
   * Mark trade as executing
   */
  async markTradeExecuting(confirmationId: string): Promise<boolean> {
    const query = `
      UPDATE protocol_trade_confirmations
      SET status = 'EXECUTING'
      WHERE id = $1
        AND status = 'ACCEPTED'
    `;

    const result = await this.pool.query(query, [confirmationId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Mark trade as executed
   */
  async markTradeExecuted(
    confirmationId: string,
    transactionHash: string,
    gasPrice: string
  ): Promise<boolean> {
    const query = `
      UPDATE protocol_trade_confirmations
      SET
        status = 'EXECUTED',
        transaction_hash = $2,
        gas_price = $3,
        executed_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND status = 'EXECUTING'
    `;

    const result = await this.pool.query(query, [
      confirmationId,
      transactionHash,
      gasPrice
    ]);

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Mark trade as failed
   */
  async markTradeFailed(
    confirmationId: string,
    errorMessage: string
  ): Promise<boolean> {
    const query = `
      UPDATE protocol_trade_confirmations
      SET
        status = 'FAILED',
        error_message = $2,
        executed_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND status IN ('EXECUTING', 'ACCEPTED')
    `;

    const result = await this.pool.query(query, [confirmationId, errorMessage]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get broadcast history for an AlphaGenerator
   */
  async getBroadcastHistory(
    alphaGeneratorId: string,
    limit: number = 50
  ): Promise<any[]> {
    const query = `
      SELECT
        tb.*,
        s.name as strategy_name,
        COUNT(DISTINCT tc.id) as recipient_count,
        COUNT(DISTINCT CASE WHEN tc.status = 'EXECUTED' THEN tc.id END) as executed_count
      FROM trade_broadcasts tb
      JOIN strategies s ON tb.strategy_id = s.strategy_id
      LEFT JOIN protocol_trade_confirmations tc ON tb.id = tc.trade_broadcast_id
      WHERE tb.alpha_generator_id = $1
      GROUP BY tb.id, s.name
      ORDER BY tb.broadcast_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [alphaGeneratorId, limit]);
    return result.rows;
  }
}

// Export factory function - creates new instance per request
export function getTradeBroadcastService(pool: Pool): TradeBroadcastService {
  return new TradeBroadcastService(pool);
}