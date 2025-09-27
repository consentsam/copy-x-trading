/**
 * @file strategy-propagator.test.ts
 * @description Unit tests for StrategyPropagator library
 * These tests should FAIL initially (TDD approach)
 */

import { describe, expect, it, beforeEach, jest, afterEach } from '@jest/globals'
import { StrategyPropagator } from '../../src/libraries/strategy-propagator'

describe('StrategyPropagator', () => {
  let strategyPropagator: StrategyPropagator
  let mockSSEConnection: any

  beforeEach(() => {
    strategyPropagator = new StrategyPropagator()
    mockSSEConnection = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn()
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('broadcast', () => {
    it('should broadcast strategy to all active subscribers', async () => {
      const strategy = {
        strategyId: 'strat_123',
        strategyName: 'BTC Long Setup',
        tradingParameters: {
          symbol: 'BTC/USDT',
          direction: 'long',
          entryPrice: 65000,
          stopLoss: 63000,
          takeProfit: 70000,
          slippageTolerance: 0.5
        },
        alphaGeneratorAddress: '0x1234567890abcdef1234567890abcdef12345678'
      }

      const results = await strategyPropagator.broadcast({ strategy })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      results.forEach(result => {
        expect(['delivered', 'failed', 'queued']).toContain(result.status)
        expect(result.deliveryId).toBeDefined()
        expect(result.consumerAddress).toBeDefined()
      })
    })

    it('should broadcast to specific subscribers only', async () => {
      const strategy = {
        strategyId: 'strat_123',
        strategyName: 'ETH Short',
        tradingParameters: {},
        alphaGeneratorAddress: '0x1234567890abcdef1234567890abcdef12345678'
      }

      const specificSubscribers = [
        '0xabc123abc123abc123abc123abc123abc123abc1',
        '0xdef456def456def456def456def456def456def4'
      ]

      const results = await strategyPropagator.broadcast({
        strategy,
        subscribers: specificSubscribers
      })

      expect(results.length).toBe(specificSubscribers.length)
      results.forEach(result => {
        expect(specificSubscribers).toContain(result.consumerAddress)
      })
    })

    it('should complete broadcast within 5 seconds (FR-010)', async () => {
      const strategy = {
        strategyId: 'strat_performance',
        strategyName: 'Performance Test',
        tradingParameters: {},
        alphaGeneratorAddress: '0x1234567890abcdef1234567890abcdef12345678'
      }

      const startTime = Date.now()
      await strategyPropagator.broadcast({ strategy })
      const endTime = Date.now()

      const broadcastTime = (endTime - startTime) / 1000
      expect(broadcastTime).toBeLessThan(5) // Must complete within 5 seconds
    })

    it('should emit broadcast events', async () => {
      const spy = jest.spyOn(strategyPropagator, 'emit')
      const strategy = {
        strategyId: 'strat_123',
        strategyName: 'Test Strategy',
        tradingParameters: {},
        alphaGeneratorAddress: '0x1234567890abcdef1234567890abcdef12345678'
      }

      await strategyPropagator.broadcast({ strategy })

      expect(spy).toHaveBeenCalledWith('strategy:broadcast', expect.objectContaining({
        strategyId: strategy.strategyId
      }))
    })
  })

  describe('queueDelivery', () => {
    it('should queue strategies for delivery', async () => {
      const strategyId = 'strat_123'
      const subscribers = [
        '0xabc123abc123abc123abc123abc123abc123abc1',
        '0xdef456def456def456def456def456def456def4'
      ]

      await strategyPropagator.queueDelivery(strategyId, subscribers)

      // Verify deliveries were queued (will fail initially)
      const queuedCount = await strategyPropagator.getQueuedCount()
      expect(queuedCount).toBeGreaterThanOrEqual(subscribers.length)
    })

    it('should store delivery records in database', async () => {
      const strategyId = 'strat_123'
      const subscribers = ['0xabc123abc123abc123abc123abc123abc123abc1']

      await strategyPropagator.queueDelivery(strategyId, subscribers)

      // Check database records (will fail initially)
      const deliveries = await strategyPropagator.getDeliveries(strategyId)
      expect(deliveries.length).toBe(subscribers.length)
      expect(deliveries[0].deliveryStatus).toBe('queued')
    })
  })

  describe('SSE Connection Management', () => {
    it('should register SSE connections', () => {
      const consumerAddress = '0xabc123abc123abc123abc123abc123abc123abc1'

      strategyPropagator.registerConnection(consumerAddress, mockSSEConnection)

      expect(strategyPropagator.getConnectionCount()).toBe(1)
      expect(strategyPropagator.isConnected(consumerAddress)).toBe(true)
    })

    it('should unregister SSE connections', () => {
      const consumerAddress = '0xabc123abc123abc123abc123abc123abc123abc1'

      strategyPropagator.registerConnection(consumerAddress, mockSSEConnection)
      strategyPropagator.unregisterConnection(consumerAddress)

      expect(strategyPropagator.getConnectionCount()).toBe(0)
      expect(strategyPropagator.isConnected(consumerAddress)).toBe(false)
    })

    it('should send SSE events to connected clients', async () => {
      const consumerAddress = '0xabc123abc123abc123abc123abc123abc123abc1'
      strategyPropagator.registerConnection(consumerAddress, mockSSEConnection)

      const strategy = {
        strategyId: 'strat_123',
        strategyName: 'Test',
        tradingParameters: {},
        alphaGeneratorAddress: '0x1234567890abcdef1234567890abcdef12345678'
      }

      await strategyPropagator.broadcast({
        strategy,
        subscribers: [consumerAddress]
      })

      expect(mockSSEConnection.write).toHaveBeenCalledWith(
        expect.stringContaining('data:')
      )
    })
  })

  describe('getMissedStrategies', () => {
    it('should return strategies missed since specified time', async () => {
      const consumerAddress = '0xabc123abc123abc123abc123abc123abc123abc1'
      const since = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago

      const missedStrategies = await strategyPropagator.getMissedStrategies(
        consumerAddress,
        since
      )

      expect(Array.isArray(missedStrategies)).toBe(true)
      missedStrategies.forEach(strategy => {
        expect(strategy.strategyId).toBeDefined()
        expect(strategy.strategyName).toBeDefined()
      })
    })

    it('should only return strategies from subscribed generators', async () => {
      const consumerAddress = '0xabc123abc123abc123abc123abc123abc123abc1'
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

      const missedStrategies = await strategyPropagator.getMissedStrategies(
        consumerAddress,
        since
      )

      // All returned strategies should be from generators the consumer subscribes to
      // This will fail initially
      expect(missedStrategies).toBeDefined()
    })
  })

  describe('retryFailed', () => {
    it('should retry failed deliveries', async () => {
      const retriedCount = await strategyPropagator.retryFailed()

      expect(typeof retriedCount).toBe('number')
      expect(retriedCount).toBeGreaterThanOrEqual(0)
    })

    it('should respect retry limit', async () => {
      // Setup failed deliveries with max retries
      const retriedCount = await strategyPropagator.retryFailed()

      // Should not retry if max retries reached (3)
      const deliveries = await strategyPropagator.getFailedDeliveries()
      deliveries.forEach(delivery => {
        expect(delivery.retryCount).toBeLessThanOrEqual(3)
      })
    })

    it('should update delivery status after successful retry', async () => {
      const spy = jest.spyOn(strategyPropagator, 'emit')

      await strategyPropagator.retryFailed()

      // Check for retry success events
      expect(spy).toHaveBeenCalledWith(
        expect.stringMatching(/delivery:(success|retry)/),
        expect.any(Object)
      )
    })
  })

  describe('getDeliveryStatus', () => {
    it('should return delivery status for a specific delivery', async () => {
      const deliveryId = 'delivery_123'

      const status = await strategyPropagator.getDeliveryStatus(deliveryId)

      expect(status).toBeDefined()
      expect(status.deliveryId).toBe(deliveryId)
      expect(['queued', 'delivered', 'failed']).toContain(status.deliveryStatus)
    })
  })

  describe('checkDeliveryHealth', () => {
    it('should report connection and delivery health', async () => {
      const consumerAddress = '0xabc123abc123abc123abc123abc123abc123abc1'

      const health = await strategyPropagator.checkDeliveryHealth(consumerAddress)

      expect(health).toBeDefined()
      expect(typeof health.connected).toBe('boolean')
      expect(typeof health.missedStrategies).toBe('number')
      if (health.lastDelivery) {
        expect(health.lastDelivery).toBeInstanceOf(Date)
      }
    })
  })

  describe('CLI interface', () => {
    it('should have CLI command handlers', () => {
      expect(strategyPropagator.cli).toBeDefined()
      expect(strategyPropagator.cli.broadcast).toBeDefined()
      expect(strategyPropagator.cli.checkDelivery).toBeDefined()
    })

    it('should broadcast via CLI with proper exit codes', async () => {
      const result = await strategyPropagator.cli.broadcast({
        strategyId: 'strat_123'
      })

      expect(result.exitCode).toBe(0) // Success
      expect(result.deliveryResults).toBeDefined()
    })

    it('should check delivery status via CLI', async () => {
      const result = await strategyPropagator.cli.checkDelivery({
        consumerAddress: '0xabc123abc123abc123abc123abc123abc123abc1',
        json: true
      })

      expect(result.exitCode).toBe(0)
      expect(result.data).toBeDefined()
      expect(typeof result.data).toBe('object')
    })
  })

  describe('Performance Requirements', () => {
    it('should handle concurrent broadcasts efficiently', async () => {
      const strategies = Array.from({ length: 10 }, (_, i) => ({
        strategyId: `strat_${i}`,
        strategyName: `Strategy ${i}`,
        tradingParameters: {},
        alphaGeneratorAddress: '0x1234567890abcdef1234567890abcdef12345678'
      }))

      const promises = strategies.map(strategy =>
        strategyPropagator.broadcast({ strategy })
      )

      const startTime = Date.now()
      await Promise.all(promises)
      const endTime = Date.now()

      const totalTime = (endTime - startTime) / 1000
      expect(totalTime).toBeLessThan(10) // 10 strategies in under 10 seconds
    })

    it('should maintain low memory footprint with many connections', () => {
      // Register 100 connections
      for (let i = 0; i < 100; i++) {
        const address = `0x${i.toString(16).padStart(40, '0')}`
        strategyPropagator.registerConnection(address, mockSSEConnection)
      }

      expect(strategyPropagator.getConnectionCount()).toBe(100)

      // Memory usage should be reasonable (this is a basic check)
      const memUsage = process.memoryUsage()
      expect(memUsage.heapUsed).toBeLessThan(100 * 1024 * 1024) // Less than 100MB
    })
  })
})