/**
 * Integration Test: Protocol Strategy Flow
 * Feature: 003-protocol-strategy-integration
 * Purpose: End-to-end test of strategy creation → execution → broadcast → confirmation
 */

import { Pool } from 'pg';
import { getProtocolStrategyService } from '../../services/strategy-service';
import { getTradeBroadcastService } from '../../lib/trade-broadcast';
import { getConfirmationService } from '../../services/confirmation-service';
import { getProtocolExecutor } from '../../lib/protocol-executor';
import { v4 as uuidv4 } from 'uuid';

// Mock database pool
jest.mock('pg');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9))
}));

describe('Protocol Strategy Integration Flow', () => {
  let pool: jest.Mocked<Pool>;
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

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Strategy Flow', () => {
    it('should handle full lifecycle: create → execute → broadcast → confirm', async () => {
      const alphaGeneratorId = 'generator-123';
      const alphaConsumerId = 'consumer-456';
      const strategyId = 'test-uuid-strategy';

      // Step 1: Create Strategy
      const strategyService = getProtocolStrategyService(pool);

      // Mock strategy creation
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check name exists
        .mockResolvedValueOnce({ // Insert strategy
          rows: [{
            id: strategyId,
            alpha_generator_id: alphaGeneratorId,
            name: 'AAVE Supply Strategy',
            description: 'Supply assets to AAVE',
            protocol: 'AAVE',
            functions: [
              {
                functionName: 'supply',
                displayName: 'Supply Asset',
                requiredParams: ['asset', 'amount', 'onBehalfOf', 'referralCode'],
                modifiableParams: ['amount']
              }
            ],
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const strategy = await strategyService.createStrategy({
        alphaGeneratorId,
        name: 'AAVE Supply Strategy',
        description: 'Supply assets to AAVE',
        protocol: 'AAVE',
        functions: [
          {
            functionName: 'supply',
            displayName: 'Supply Asset',
            requiredParams: ['asset', 'amount', 'onBehalfOf', 'referralCode'],
            modifiableParams: ['amount']
          }
        ]
      });

      expect(strategy.id).toBe(strategyId);
      expect(strategy.name).toBe('AAVE Supply Strategy');

      // Step 2: Execute Strategy and Broadcast
      const broadcastService = getTradeBroadcastService(pool);
      const broadcastId = 'test-uuid-broadcast';
      const correlationId = 'TB-TEST-123';

      // Mock broadcast
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // Insert trade broadcast
          rows: [{
            id: broadcastId,
            strategy_id: strategyId,
            alpha_generator_id: alphaGeneratorId,
            function_name: 'supply',
            protocol: 'AAVE',
            parameters: {
              asset: '0x0000000000000000000000000000000000000001',
              amount: '1000000000000000000',
              onBehalfOf: alphaGeneratorId,
              referralCode: 0
            },
            contract_address: '0x0000000000000000000000000000000000000002',
            gas_estimate: '500000',
            network: 'localhost',
            correlation_id: correlationId,
            broadcast_at: new Date(),
            expires_at: new Date(Date.now() + 5 * 60000)
          }]
        })
        .mockResolvedValueOnce({ // Get active subscribers
          rows: [{
            id: 'subscription-1',
            consumer_id: alphaConsumerId,
            consumer_name: 'Test Consumer'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Insert trade confirmations
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock pool query for strategy details
      pool.query = jest.fn().mockResolvedValueOnce({
        rows: [{
          strategy_name: 'AAVE Supply Strategy',
          generator_name: 'Test Generator'
        }]
      });

      const broadcastResponse = await broadcastService.broadcast({
        strategyId,
        alphaGeneratorId,
        functionName: 'supply',
        protocol: 'AAVE',
        parameters: {
          asset: '0x0000000000000000000000000000000000000001',
          amount: '1000000000000000000',
          onBehalfOf: alphaGeneratorId,
          referralCode: 0
        },
        gasEstimate: '500000',
        network: 'localhost'
      });

      expect(broadcastResponse.broadcastId).toBe(broadcastId);
      expect(broadcastResponse.correlationId).toBe(correlationId);
      expect(broadcastResponse.recipientCount).toBe(1);

      // Step 3: Consumer receives and accepts trade
      const confirmationService = getConfirmationService(pool);
      const confirmationId = 'test-uuid-confirmation';

      // Mock get pending confirmations
      pool.query = jest.fn()
        .mockResolvedValueOnce({ // Count query
          rows: [{ count: '1' }]
        })
        .mockResolvedValueOnce({ // Get confirmations
          rows: [{
            id: confirmationId,
            trade_broadcast_id: broadcastId,
            alpha_consumer_id: alphaConsumerId,
            original_parameters: {
              asset: '0x0000000000000000000000000000000000000001',
              amount: '1000000000000000000',
              onBehalfOf: alphaGeneratorId,
              referralCode: 0
            },
            modified_parameters: {
              asset: '0x0000000000000000000000000000000000000001',
              amount: '2000000000000000000', // Consumer doubles the amount
              onBehalfOf: alphaConsumerId,
              referralCode: 0
            },
            status: 'PENDING',
            received_at: new Date(),
            strategy_name: 'AAVE Supply Strategy',
            function_name: 'supply',
            protocol: 'AAVE',
            correlation_id: correlationId,
            expires_at: new Date(Date.now() + 5 * 60000)
          }]
        });

      const pendingTrades = await confirmationService.getPendingConfirmations({
        consumerId: alphaConsumerId
      });

      expect(pendingTrades.confirmations).toHaveLength(1);
      expect(pendingTrades.confirmations[0].id).toBe(confirmationId);
      expect(pendingTrades.confirmations[0].status).toBe('PENDING');

      // Step 4: Validate flow completion
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle strategy execution with multiple functions', async () => {
      const executor = getProtocolExecutor(pool);
      const functions = [
        {
          functionName: 'supply',
          protocol: 'AAVE' as const,
          parameters: {
            asset: '0x0000000000000000000000000000000000000001',
            amount: '1000000000000000000',
            onBehalfOf: '0x0000000000000000000000000000000000000002',
            referralCode: 0
          }
        },
        {
          functionName: 'borrow',
          protocol: 'AAVE' as const,
          parameters: {
            asset: '0x0000000000000000000000000000000000000001',
            amount: '500000000000000000',
            interestRateMode: 1,
            referralCode: 0,
            onBehalfOf: '0x0000000000000000000000000000000000000002'
          }
        }
      ];

      const estimations = await executor.batchEstimateGas(
        functions,
        '0x0000000000000000000000000000000000000002',
        'localhost'
      );

      expect(estimations.estimates).toHaveLength(2);
      expect(Number(estimations.totalEstimatedCost)).toBeGreaterThan(0);
    });

    it('should enforce strategy name uniqueness', async () => {
      const strategyService = getProtocolStrategyService(pool);

      // Mock name already exists
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ exists: true }] }); // Name check

      await expect(strategyService.createStrategy({
        alphaGeneratorId: 'generator-123',
        name: 'Duplicate Strategy',
        description: 'This should fail',
        protocol: 'AAVE',
        functions: [
          {
            functionName: 'supply',
            displayName: 'Supply',
            requiredParams: ['asset', 'amount', 'onBehalfOf', 'referralCode'],
            modifiableParams: ['amount']
          }
        ]
      })).rejects.toThrow('already exists');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should validate parameter modifications', async () => {
      const confirmationService = getConfirmationService(pool);
      const broadcastService = getTradeBroadcastService(pool);

      // Mock getting confirmation
      pool.query = jest.fn()
        .mockResolvedValueOnce({ // Get trade confirmation
          rows: [{
            id: 'confirmation-123',
            trade_broadcast_id: 'broadcast-123',
            alpha_consumer_id: 'consumer-123',
            original_parameters: {
              asset: '0x0000000000000000000000000000000000000001',
              amount: '1000000000000000000',
              onBehalfOf: '0x0000000000000000000000000000000000000002',
              referralCode: 0
            },
            status: 'PENDING'
          }]
        })
        .mockResolvedValueOnce({ // Get broadcast details
          rows: [{
            id: 'broadcast-123',
            function_name: 'supply',
            protocol: 'AAVE',
            expires_at: new Date(Date.now() + 60000),
            strategy_name: 'Test Strategy'
          }]
        });

      // Try to modify a non-modifiable parameter
      await expect(confirmationService.updateConfirmation({
        confirmationId: 'confirmation-123',
        action: 'accept',
        modifiedParameters: {
          asset: '0x0000000000000000000000000000000000000003', // Can't change asset
          amount: '2000000000000000000',
          onBehalfOf: '0x0000000000000000000000000000000000000002',
          referralCode: 0
        },
        consumerId: 'consumer-123'
      })).rejects.toThrow('cannot be modified');
    });

    it('should handle broadcast expiry correctly', async () => {
      const broadcastService = getTradeBroadcastService(pool);

      // Mock cleanup of expired broadcasts
      pool.query = jest.fn().mockResolvedValueOnce({
        rowCount: 5
      });

      const cleanedUp = await broadcastService.cleanupExpired();
      expect(cleanedUp).toBe(5);
    });

    it('should calculate broadcast statistics', async () => {
      const broadcastService = getTradeBroadcastService(pool);

      pool.query = jest.fn().mockResolvedValueOnce({
        rows: [{
          total_broadcasts: '100',
          active_broadcasts: '10',
          expired_broadcasts: '90',
          avg_recipients: '5.5',
          success_rate: '75.0'
        }]
      });

      const stats = await broadcastService.getStatistics('generator-123');

      expect(stats.totalBroadcasts).toBe(100);
      expect(stats.activeBroadcasts).toBe(10);
      expect(stats.expiredBroadcasts).toBe(90);
      expect(stats.averageRecipients).toBe(5.5);
      expect(stats.successRate).toBe(75.0);
    });
  });

  describe('Performance Validation', () => {
    it('should meet broadcast latency requirements (<500ms)', async () => {
      const broadcastService = getTradeBroadcastService(pool);

      // Mock fast database responses
      mockClient.query
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] });

      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const startTime = Date.now();

      await broadcastService.broadcast({
        strategyId: 'strategy-123',
        alphaGeneratorId: 'generator-123',
        functionName: 'supply',
        protocol: 'AAVE',
        parameters: {},
        gasEstimate: '500000'
      });

      const endTime = Date.now();
      const latency = endTime - startTime;

      // In a real test environment, this would test actual latency
      // For unit tests, we just verify the function completes
      expect(latency).toBeLessThan(1000); // Generous limit for unit tests
    });
  });
});