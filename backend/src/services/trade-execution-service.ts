/**
 * Trade Execution Service
 * Feature: 003-protocol-strategy-integration
 * Purpose: Service for executing accepted trades on-chain
 */

import { Pool } from 'pg';
import { getTradeBroadcastService } from '../lib/trade-broadcast';
import { getProtocolExecutor } from '../lib/protocol-executor';
import { getSSEBroadcastService } from './sse-broadcast-service';
import { ExecutionRequest, ExecutionResponse } from '../lib/protocol-executor/types';

export interface ExecuteTradeRequest {
  confirmationId: string;
  consumerAddress: string;
  privateKey?: string; // Optional, for automated execution
}

export interface ExecuteTradeResponse {
  confirmationId: string;
  transactionHash: string;
  gasUsed: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export class TradeExecutionService {
  private pool: Pool;
  private broadcastService: ReturnType<typeof getTradeBroadcastService>;
  private executorService: ReturnType<typeof getProtocolExecutor>;
  private sseService: ReturnType<typeof getSSEBroadcastService>;

  constructor(pool: Pool) {
    this.pool = pool;
    this.broadcastService = getTradeBroadcastService(pool);
    this.executorService = getProtocolExecutor(pool);
    this.sseService = getSSEBroadcastService(pool);
  }

  /**
   * Execute an accepted trade
   */
  async executeTrade(request: ExecuteTradeRequest): Promise<ExecuteTradeResponse> {
    try {
      // Get trade confirmation details
      const confirmation = await this.broadcastService.getTradeConfirmation(
        request.confirmationId
      );

      if (!confirmation) {
        throw new Error('Trade confirmation not found');
      }

      if (confirmation.status !== 'ACCEPTED') {
        throw new Error(`Trade must be accepted before execution. Current status: ${confirmation.status}`);
      }

      // Get trade broadcast details
      const broadcastQuery = `
        SELECT tb.*, s.protocol, s.name as strategy_name
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

      // Check if trade is expired
      if (new Date(broadcast.expires_at) < new Date()) {
        throw new Error('Trade broadcast has expired');
      }

      // Mark trade as executing
      await this.broadcastService.markTradeExecuting(request.confirmationId);

      // Send SSE notification
      await this.sseService.sendTradeConfirmation(confirmation.alphaConsumerId, {
        ...confirmation,
        status: 'EXECUTING'
      });

      // Prepare execution request
      const executionRequest: ExecutionRequest = {
        functionName: broadcast.function_name,
        protocol: broadcast.protocol,
        parameters: confirmation.modifiedParameters, // Use consumer's modified parameters
        contractAddress: broadcast.contract_address,
        network: broadcast.network,
        userAddress: request.consumerAddress
      };

      // Configure executor with private key if provided
      if (request.privateKey) {
        this.executorService.updateConfig({
          privateKey: request.privateKey
        });
      }

      // Execute the trade
      const executionResponse: ExecutionResponse = await this.executorService.execute(
        executionRequest
      );

      if (executionResponse.status === 'success') {
        // Mark trade as executed
        await this.broadcastService.markTradeExecuted(
          request.confirmationId,
          executionResponse.transactionHash,
          executionResponse.gasUsed
        );

        // Send success notification
        await this.sseService.sendTradeConfirmation(confirmation.alphaConsumerId, {
          ...confirmation,
          status: 'EXECUTED',
          transactionHash: executionResponse.transactionHash
        });

        // Notify generator of successful execution
        await this.sseService.sendExecutionStatus(broadcast.alpha_generator_id, {
          strategyName: broadcast.strategy_name,
          functionName: broadcast.function_name,
          status: 'executed',
          transactionHash: executionResponse.transactionHash,
          consumer: confirmation.alphaConsumerId,
          correlationId: broadcast.correlation_id
        });

        return {
          confirmationId: request.confirmationId,
          transactionHash: executionResponse.transactionHash,
          gasUsed: executionResponse.gasUsed,
          status: 'success'
        };
      } else {
        // Mark trade as failed
        await this.broadcastService.markTradeFailed(
          request.confirmationId,
          executionResponse.errorMessage || 'Unknown error'
        );

        // Send failure notification
        await this.sseService.sendTradeConfirmation(confirmation.alphaConsumerId, {
          ...confirmation,
          status: 'FAILED',
          errorMessage: executionResponse.errorMessage
        });

        return {
          confirmationId: request.confirmationId,
          transactionHash: '',
          gasUsed: '0',
          status: 'failed',
          errorMessage: executionResponse.errorMessage
        };
      }
    } catch (error: any) {
      console.error('Trade execution error:', error);

      // Try to mark trade as failed
      try {
        await this.broadcastService.markTradeFailed(
          request.confirmationId,
          error.message
        );
      } catch (updateError) {
        console.error('Failed to update trade status:', updateError);
      }

      throw error;
    }
  }

  /**
   * Batch execute multiple trades
   */
  async batchExecuteTrades(
    confirmationIds: string[],
    consumerAddress: string,
    privateKey?: string
  ): Promise<ExecuteTradeResponse[]> {
    const results: ExecuteTradeResponse[] = [];

    for (const confirmationId of confirmationIds) {
      try {
        const result = await this.executeTrade({
          confirmationId,
          consumerAddress,
          privateKey
        });
        results.push(result);
      } catch (error: any) {
        results.push({
          confirmationId,
          transactionHash: '',
          gasUsed: '0',
          status: 'failed',
          errorMessage: error.message
        });
      }
    }

    return results;
  }

  /**
   * Simulate trade execution (dry run)
   */
  async simulateTrade(confirmationId: string, consumerAddress: string): Promise<{
    gasEstimate: string;
    estimatedCost: string;
    parameters: any;
  }> {
    // Get trade confirmation details
    const confirmation = await this.broadcastService.getTradeConfirmation(confirmationId);

    if (!confirmation) {
      throw new Error('Trade confirmation not found');
    }

    // Get trade broadcast details
    const broadcastQuery = `
      SELECT tb.*, s.protocol
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

    // Prepare execution request for gas estimation
    const executionRequest: ExecutionRequest = {
      functionName: broadcast.function_name,
      protocol: broadcast.protocol,
      parameters: confirmation.modifiedParameters,
      contractAddress: broadcast.contract_address,
      network: broadcast.network,
      userAddress: consumerAddress
    };

    // Estimate gas
    const gasEstimation = await this.executorService.estimateGas(executionRequest);

    return {
      gasEstimate: gasEstimation.gasLimit,
      estimatedCost: gasEstimation.totalCost,
      parameters: confirmation.modifiedParameters
    };
  }

  /**
   * Get execution history for a consumer
   */
  async getExecutionHistory(
    consumerId: string,
    limit: number = 50
  ): Promise<any[]> {
    const query = `
      SELECT
        tc.*,
        tb.function_name,
        tb.protocol,
        tb.correlation_id,
        s.name as strategy_name
      FROM protocol_trade_confirmations tc
      JOIN trade_broadcasts tb ON tc.trade_broadcast_id = tb.id
      JOIN strategies s ON tb.strategy_id = s.strategy_id
      WHERE tc.alpha_consumer_id = $1
        AND tc.status IN ('EXECUTED', 'FAILED')
      ORDER BY tc.executed_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [consumerId, limit]);
    return result.rows;
  }
}

// Export factory function - creates new instance per request
export function getTradeExecutionService(pool: Pool): TradeExecutionService {
  return new TradeExecutionService(pool);
}