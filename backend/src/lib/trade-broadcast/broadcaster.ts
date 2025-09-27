/**
 * Trade Broadcaster
 * Feature: 003-protocol-strategy-integration
 * Purpose: Core broadcasting logic for trade propagation
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  TradeBroadcast,
  BroadcastRequest,
  BroadcastResponse,
  BroadcastStatistics,
  SubscriberNotification
} from './types';
import { getProtocolRegistry } from '../protocol-contracts/registry';

export class TradeBroadcaster {
  private pool: Pool;
  private sseClients: Map<string, any> = new Map(); // SSE client connections

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Broadcast a trade to all active subscribers
   */
  async broadcastTrade(request: BroadcastRequest): Promise<BroadcastResponse> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Generate correlation ID for tracking
      const correlationId = this.generateCorrelationId();
      const broadcastId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (request.expiryMinutes || 5) * 60000);

      // Get contract address from registry
      const registry = getProtocolRegistry(this.pool);
      const contractName = request.protocol === 'AAVE' ? 'Pool' : 'SwapRouter';
      const contract = await registry.getContract(
        request.protocol,
        contractName,
        request.network as any || 'localhost'
      );

      if (!contract) {
        throw new Error(`Contract not found for ${request.protocol}`);
      }

      // Insert trade broadcast
      const insertQuery = `
        INSERT INTO trade_broadcasts (
          id, strategy_id, alpha_generator_id, function_name,
          protocol, parameters, contract_address, gas_estimate,
          network, correlation_id, broadcast_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        broadcastId,
        request.strategyId,
        request.alphaGeneratorId,
        request.functionName,
        request.protocol,
        JSON.stringify(request.parameters),
        contract.address,
        request.gasEstimate,
        request.network || 'localhost',
        correlationId,
        now,
        expiresAt
      ]);

      const tradeBroadcast: TradeBroadcast = {
        id: result.rows[0].id,
        strategyId: result.rows[0].strategy_id,
        alphaGeneratorId: result.rows[0].alpha_generator_id,
        functionName: result.rows[0].function_name,
        protocol: result.rows[0].protocol,
        parameters: result.rows[0].parameters,
        contractAddress: result.rows[0].contract_address,
        gasEstimate: result.rows[0].gas_estimate,
        network: result.rows[0].network,
        correlationId: result.rows[0].correlation_id,
        broadcastAt: result.rows[0].broadcast_at,
        expiresAt: result.rows[0].expires_at
      };

      // Get active subscribers
      const subscribers = await this.getActiveSubscribers(request.alphaGeneratorId, client);

      // Create trade confirmations for each subscriber
      const recipientCount = await this.createTradeConfirmations(
        tradeBroadcast,
        subscribers,
        client
      );

      // Send SSE notifications
      await this.sendSSENotifications(tradeBroadcast, subscribers);

      await client.query('COMMIT');

      return {
        broadcastId,
        correlationId,
        recipientCount,
        broadcastAt: now,
        expiresAt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Broadcast error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active subscribers for an AlphaGenerator
   */
  private async getActiveSubscribers(
    alphaGeneratorId: string,
    client: any
  ): Promise<Array<{ id: string; consumerId: string; consumerName: string }>> {
    // Get generator address from ID
    const generatorQuery = `SELECT generator_address FROM alpha_generators WHERE generator_id = $1`;
    const genResult = await client.query(generatorQuery, [alphaGeneratorId]);

    if (!genResult.rows[0]) {
      return [];
    }

    const generatorAddress = genResult.rows[0].generator_address;

    const query = `
      SELECT
        s.subscription_id as id,
        ac.consumer_id,
        ac.display_name as consumer_name
      FROM subscriptions s
      JOIN alpha_consumers ac ON s.alpha_consumer_address = ac.wallet_address
      WHERE s.alpha_generator_address = $1
        AND s.is_active = true
        AND s.expires_at > CURRENT_TIMESTAMP
    `;

    const result = await client.query(query, [generatorAddress]);

    return result.rows.map((row: any) => ({
      id: row.id,
      consumerId: row.consumer_id,
      consumerName: row.consumer_name
    }));
  }

  /**
   * Create trade confirmations for subscribers
   */
  private async createTradeConfirmations(
    broadcast: TradeBroadcast,
    subscribers: Array<{ id: string; consumerId: string }>,
    client: any
  ): Promise<number> {
    if (subscribers.length === 0) {
      return 0;
    }

    const values: any[] = [];
    const placeholders: string[] = [];

    subscribers.forEach((subscriber, index) => {
      const offset = index * 5;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
      );
      values.push(
        uuidv4(),
        broadcast.id,
        subscriber.consumerId,
        JSON.stringify(broadcast.parameters),
        JSON.stringify(broadcast.parameters) // Initially same as original
      );
    });

    const insertQuery = `
      INSERT INTO protocol_trade_confirmations (
        id, trade_broadcast_id, alpha_consumer_id,
        original_parameters, modified_parameters
      ) VALUES ${placeholders.join(', ')}
    `;

    await client.query(insertQuery, values);
    return subscribers.length;
  }

  /**
   * Send SSE notifications to connected clients
   */
  private async sendSSENotifications(
    broadcast: TradeBroadcast,
    subscribers: Array<{ id: string; consumerId: string; consumerName: string }>
  ): Promise<void> {
    // Get strategy and generator details
    const strategyQuery = `
      SELECT s.strategy_name, ag.name as generator_name
      FROM strategies s
      JOIN alpha_generators ag ON s.alpha_generator_address = ag.generator_address
      WHERE s.strategy_id = $1
    `;

    const result = await this.pool.query(strategyQuery, [broadcast.strategyId]);

    if (result.rows.length === 0) {
      console.warn(`Strategy ${broadcast.strategyId} not found`);
      return;
    }

    const { strategy_name, generator_name } = result.rows[0];

    // Send to each subscriber's SSE connection if they're connected
    for (const subscriber of subscribers) {
      const notification: SubscriberNotification = {
        subscriberId: subscriber.consumerId,
        tradeBroadcast: broadcast,
        strategyName: strategy_name,
        alphaGeneratorName: generator_name
      };

      // If SSE client is connected, send notification
      const client = this.sseClients.get(subscriber.consumerId);
      if (client) {
        this.sendSSEEvent(client, 'trade-broadcast', notification);
      }
    }

    console.log(`Sent SSE notifications to ${subscribers.length} subscribers`);
  }

  /**
   * Send SSE event to a client
   */
  private sendSSEEvent(client: any, eventType: string, data: any): void {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    client.write(message);
  }

  /**
   * Register SSE client connection
   */
  registerSSEClient(consumerId: string, client: any): void {
    this.sseClients.set(consumerId, client);
    console.log(`SSE client registered for consumer: ${consumerId}`);
  }

  /**
   * Unregister SSE client connection
   */
  unregisterSSEClient(consumerId: string): void {
    this.sseClients.delete(consumerId);
    console.log(`SSE client unregistered for consumer: ${consumerId}`);
  }

  /**
   * Get broadcast statistics
   */
  async getStatistics(alphaGeneratorId?: string): Promise<BroadcastStatistics> {
    let whereClause = '';
    const params: any[] = [];

    if (alphaGeneratorId) {
      whereClause = 'WHERE tb.alpha_generator_id = $1';
      params.push(alphaGeneratorId);
    }

    const query = `
      SELECT
        COUNT(DISTINCT tb.id) as total_broadcasts,
        COUNT(DISTINCT CASE WHEN tb.expires_at > CURRENT_TIMESTAMP THEN tb.id END) as active_broadcasts,
        COUNT(DISTINCT CASE WHEN tb.expires_at <= CURRENT_TIMESTAMP THEN tb.id END) as expired_broadcasts,
        AVG((
          SELECT COUNT(*)
          FROM protocol_trade_confirmations tc
          WHERE tc.trade_broadcast_id = tb.id
        )) as avg_recipients,
        AVG(CASE
          WHEN tc.status = 'EXECUTED' THEN 1
          WHEN tc.status IN ('REJECTED', 'FAILED') THEN 0
          ELSE NULL
        END) * 100 as success_rate
      FROM trade_broadcasts tb
      LEFT JOIN protocol_trade_confirmations tc ON tb.id = tc.trade_broadcast_id
      ${whereClause}
    `;

    const result = await this.pool.query(query, params);
    const row = result.rows[0];

    return {
      totalBroadcasts: parseInt(row.total_broadcasts) || 0,
      activeBroadcasts: parseInt(row.active_broadcasts) || 0,
      expiredBroadcasts: parseInt(row.expired_broadcasts) || 0,
      averageRecipients: parseFloat(row.avg_recipients) || 0,
      successRate: parseFloat(row.success_rate) || 0
    };
  }

  /**
   * Get pending trades for a consumer
   */
  async getPendingTrades(consumerId: string): Promise<any[]> {
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
      WHERE tc.alpha_consumer_id = $1
        AND tc.status = 'PENDING'
        AND tb.expires_at > CURRENT_TIMESTAMP
      ORDER BY tc.received_at DESC
    `;

    const result = await this.pool.query(query, [consumerId]);
    return result.rows;
  }

  /**
   * Update trade confirmation status
   */
  async updateTradeStatus(
    confirmationId: string,
    status: 'ACCEPTED' | 'REJECTED',
    modifiedParameters?: Record<string, any>
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update the trade confirmation
      const updateQuery = `
        UPDATE protocol_trade_confirmations
        SET
          status = $2,
          decided_at = CURRENT_TIMESTAMP,
          modified_parameters = $3
        WHERE id = $1
          AND status = 'PENDING'
        RETURNING *
      `;

      const result = await client.query(updateQuery, [
        confirmationId,
        status,
        JSON.stringify(modifiedParameters || {})
      ]);

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update status error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clean up expired broadcasts
   */
  async cleanupExpiredBroadcasts(): Promise<number> {
    const query = `
      UPDATE protocol_trade_confirmations
      SET status = 'REJECTED'
      WHERE status = 'PENDING'
        AND trade_broadcast_id IN (
          SELECT id FROM trade_broadcasts
          WHERE expires_at < CURRENT_TIMESTAMP
        )
    `;

    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }

  /**
   * Generate correlation ID for tracking
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return `TB-${timestamp}-${randomPart}`.toUpperCase();
  }
}