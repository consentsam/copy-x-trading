/**
 * Trade Broadcast Tests
 * Feature: 003-protocol-strategy-integration
 */

import { getTradeBroadcastService, TradeBroadcastService } from '../index';
import { BroadcastRequest } from '../types';
import { Pool } from 'pg';

// Mock dependencies
jest.mock('pg');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid')
}));

describe('TradeBroadcastService', () => {
  let pool: jest.Mocked<Pool>;
  let service: TradeBroadcastService;
  let mockClient: any;

  beforeEach(() => {
    // Setup mock pool and client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    pool = {
      connect: jest.fn(() => Promise.resolve(mockClient)),
      query: jest.fn(),
      end: jest.fn()
    } as any;

    service = getTradeBroadcastService(pool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('broadcast', () => {
    it('should broadcast a trade successfully', async () => {
      const request: BroadcastRequest = {
        strategyId: 'strategy-123',
        alphaGeneratorId: 'generator-123',
        functionName: 'supply',
        protocol: 'AAVE',
        parameters: { amount: '1000000000000000000' },
        gasEstimate: '500000',
        network: 'localhost',
        expiryMinutes: 5
      };

      // Mock database responses
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // Insert trade broadcast
          rows: [{
            id: 'test-uuid',
            strategy_id: request.strategyId,
            alpha_generator_id: request.alphaGeneratorId,
            function_name: request.functionName,
            protocol: request.protocol,
            parameters: request.parameters,
            contract_address: '0x0000000000000000000000000000000000000001',
            gas_estimate: request.gasEstimate,
            network: request.network,
            correlation_id: 'TB-TEST-123',
            broadcast_at: new Date(),
            expires_at: new Date(Date.now() + 5 * 60000)
          }]
        })
        .mockResolvedValueOnce({ // Get active subscribers
          rows: [
            { id: 'sub-1', consumer_id: 'consumer-1', consumer_name: 'Consumer 1' },
            { id: 'sub-2', consumer_id: 'consumer-2', consumer_name: 'Consumer 2' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] }) // Insert trade confirmations
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock pool query for strategy details
      pool.query = jest.fn().mockResolvedValueOnce({
        rows: [{
          strategy_name: 'Test Strategy',
          generator_name: 'Test Generator'
        }]
      });

      const response = await service.broadcast(request);

      expect(response).toHaveProperty('broadcastId');
      expect(response).toHaveProperty('correlationId');
      expect(response.recipientCount).toBe(2);
      expect(response).toHaveProperty('broadcastAt');
      expect(response).toHaveProperty('expiresAt');
    });

    it('should validate required fields', async () => {
      const invalidRequest: BroadcastRequest = {
        strategyId: '',
        alphaGeneratorId: '',
        functionName: 'supply',
        protocol: 'AAVE',
        parameters: {},
        gasEstimate: '500000'
      };

      await expect(service.broadcast(invalidRequest))
        .rejects
        .toThrow('Strategy ID and AlphaGenerator ID are required');
    });

    it('should rollback on error', async () => {
      const request: BroadcastRequest = {
        strategyId: 'strategy-123',
        alphaGeneratorId: 'generator-123',
        functionName: 'supply',
        protocol: 'AAVE',
        parameters: { amount: '1000000000000000000' },
        gasEstimate: '500000'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // Insert fails

      await expect(service.broadcast(request))
        .rejects
        .toThrow('Database error');

      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getPendingTrades', () => {
    it('should return pending trades for a consumer', async () => {
      const consumerId = 'consumer-123';

      pool.query = jest.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'confirmation-1',
            trade_broadcast_id: 'broadcast-1',
            alpha_consumer_id: consumerId,
            original_parameters: { amount: '1000' },
            modified_parameters: { amount: '1000' },
            status: 'PENDING',
            received_at: new Date()
          }
        ]
      });

      const trades = await service.getPendingTrades(consumerId);

      expect(trades).toHaveLength(1);
      expect(trades[0].status).toBe('PENDING');
      expect(trades[0].alphaConsumerId).toBe(consumerId);
    });
  });

  describe('acceptTrade', () => {
    it('should accept a trade with modified parameters', async () => {
      const confirmationId = 'confirmation-123';
      const modifiedParams = { amount: '2000' };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const success = await service.acceptTrade(confirmationId, modifiedParams);

      expect(success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trade_confirmations'),
        expect.arrayContaining([confirmationId, 'ACCEPTED', JSON.stringify(modifiedParams)])
      );
    });

    it('should return false if trade is not pending', async () => {
      const confirmationId = 'confirmation-123';

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0 }) // UPDATE fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const success = await service.acceptTrade(confirmationId);

      expect(success).toBe(false);
    });
  });

  describe('rejectTrade', () => {
    it('should reject a trade', async () => {
      const confirmationId = 'confirmation-123';

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const success = await service.rejectTrade(confirmationId);

      expect(success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trade_confirmations'),
        expect.arrayContaining([confirmationId, 'REJECTED'])
      );
    });
  });

  describe('getStatistics', () => {
    it('should return broadcast statistics', async () => {
      pool.query = jest.fn().mockResolvedValueOnce({
        rows: [{
          total_broadcasts: '10',
          active_broadcasts: '3',
          expired_broadcasts: '7',
          avg_recipients: '5.5',
          success_rate: '85.0'
        }]
      });

      const stats = await service.getStatistics();

      expect(stats.totalBroadcasts).toBe(10);
      expect(stats.activeBroadcasts).toBe(3);
      expect(stats.expiredBroadcasts).toBe(7);
      expect(stats.averageRecipients).toBe(5.5);
      expect(stats.successRate).toBe(85.0);
    });
  });

  describe('cleanupExpired', () => {
    it('should cleanup expired broadcasts', async () => {
      pool.query = jest.fn().mockResolvedValueOnce({
        rowCount: 5
      });

      const count = await service.cleanupExpired();

      expect(count).toBe(5);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trade_confirmations')
      );
    });
  });

  describe('markTradeExecuted', () => {
    it('should mark trade as executed with transaction details', async () => {
      const confirmationId = 'confirmation-123';
      const txHash = '0xabc123';
      const gasPrice = '20000000000';

      pool.query = jest.fn().mockResolvedValueOnce({
        rowCount: 1
      });

      const success = await service.markTradeExecuted(confirmationId, txHash, gasPrice);

      expect(success).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trade_confirmations'),
        [confirmationId, txHash, gasPrice]
      );
    });
  });

  describe('markTradeFailed', () => {
    it('should mark trade as failed with error message', async () => {
      const confirmationId = 'confirmation-123';
      const errorMessage = 'Transaction reverted';

      pool.query = jest.fn().mockResolvedValueOnce({
        rowCount: 1
      });

      const success = await service.markTradeFailed(confirmationId, errorMessage);

      expect(success).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trade_confirmations'),
        [confirmationId, errorMessage]
      );
    });
  });

  describe('getBroadcastHistory', () => {
    it('should return broadcast history for an AlphaGenerator', async () => {
      const alphaGeneratorId = 'generator-123';

      pool.query = jest.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'broadcast-1',
            strategy_name: 'Strategy 1',
            function_name: 'supply',
            recipient_count: '5',
            executed_count: '3',
            broadcast_at: new Date()
          },
          {
            id: 'broadcast-2',
            strategy_name: 'Strategy 2',
            function_name: 'swap',
            recipient_count: '3',
            executed_count: '2',
            broadcast_at: new Date()
          }
        ]
      });

      const history = await service.getBroadcastHistory(alphaGeneratorId, 10);

      expect(history).toHaveLength(2);
      expect(history[0]).toHaveProperty('strategy_name');
      expect(history[0]).toHaveProperty('recipient_count');
      expect(history[0]).toHaveProperty('executed_count');
    });
  });
});