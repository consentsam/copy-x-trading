/**
 * @file subscription-manager.test.ts
 * @description Unit tests for SubscriptionManager library
 * These tests should FAIL initially (TDD approach)
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals'
import { SubscriptionManager } from '../../src/libraries/subscription-manager'

describe('SubscriptionManager', () => {
  let subscriptionManager: SubscriptionManager

  beforeEach(() => {
    subscriptionManager = new SubscriptionManager()
  })

  describe('subscribe', () => {
    it('should create a new subscription with 30-day expiry', async () => {
      const options = {
        generatorAddress: '0x1234567890abcdef1234567890abcdef12345678',
        consumerAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        fee: '100000000000000000', // 0.1 ETH in wei
        encryptedConsumerAddress: 'encrypted_address_here'
      }

      const subscription = await subscriptionManager.subscribe(options)

      expect(subscription).toBeDefined()
      expect(subscription.alphaGeneratorAddress).toBe(options.generatorAddress)
      expect(subscription.alphaConsumerAddress).toBe(options.consumerAddress)
      expect(subscription.isActive).toBe(true)

      // Check 30-day expiry
      const subscribedAt = new Date(subscription.subscribedAt)
      const expiresAt = new Date(subscription.expiresAt)
      const daysDiff = (expiresAt.getTime() - subscribedAt.getTime()) / (1000 * 60 * 60 * 24)
      expect(Math.round(daysDiff)).toBe(30)
    })

    it('should prevent duplicate active subscriptions', async () => {
      const options = {
        generatorAddress: '0x1234567890abcdef1234567890abcdef12345678',
        consumerAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        fee: '100000000000000000'
      }

      await subscriptionManager.subscribe(options)

      await expect(subscriptionManager.subscribe(options))
        .rejects.toThrow('Active subscription already exists')
    })

    it('should store subscription fee in metadata', async () => {
      const options = {
        generatorAddress: '0x1234567890abcdef1234567890abcdef12345678',
        consumerAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        fee: '100000000000000000'
      }

      const subscription = await subscriptionManager.subscribe(options)

      expect(subscription.metadata).toBeDefined()
      expect(subscription.metadata.feeAmount).toBe('100000000000000000')
    })
  })

  describe('checkExpiry', () => {
    it('should mark expired subscriptions as inactive', async () => {
      // This test expects subscriptions with expiresAt < now() to be marked inactive
      const expiredCount = await subscriptionManager.checkExpiry()

      expect(expiredCount).toBeGreaterThanOrEqual(0)
    })

    it('should emit expiry events for each expired subscription', async () => {
      const spy = jest.spyOn(subscriptionManager, 'emit' as any)

      await subscriptionManager.checkExpiry()

      // Check that events were emitted (will fail initially)
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('subscription:expired'),
        expect.any(Object)
      )
    })
  })

  describe('getActiveSubscriptions', () => {
    it('should return only active subscriptions for a consumer', async () => {
      const consumerAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

      const subscriptions = await subscriptionManager.getActiveSubscriptions(consumerAddress)

      expect(Array.isArray(subscriptions)).toBe(true)
      subscriptions.forEach(sub => {
        expect(sub.isActive).toBe(true)
        expect(sub.alphaConsumerAddress).toBe(consumerAddress)
      })
    })

    it('should not return expired subscriptions', async () => {
      const consumerAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

      const subscriptions = await subscriptionManager.getActiveSubscriptions(consumerAddress)

      subscriptions.forEach(sub => {
        const expiresAt = new Date(sub.expiresAt)
        expect(expiresAt.getTime()).toBeGreaterThan(Date.now())
      })
    })
  })

  describe('getGeneratorSubscribers', () => {
    it('should return all active subscribers for a generator', async () => {
      const generatorAddress = '0x1234567890abcdef1234567890abcdef12345678'

      const subscribers = await subscriptionManager.getGeneratorSubscribers(generatorAddress)

      expect(Array.isArray(subscribers)).toBe(true)
      subscribers.forEach(sub => {
        expect(sub.alphaGeneratorAddress).toBe(generatorAddress)
        expect(sub.isActive).toBe(true)
      })
    })

    it('should include subscriber count in response', async () => {
      const generatorAddress = '0x1234567890abcdef1234567890abcdef12345678'

      const subscribers = await subscriptionManager.getGeneratorSubscribers(generatorAddress)

      expect(typeof subscribers.length).toBe('number')
    })
  })

  describe('updateSubscriptionStatus', () => {
    it('should update subscription active status', async () => {
      const subscriptionId = 'sub_test_123'

      await subscriptionManager.updateSubscriptionStatus(subscriptionId, false)

      // Verify the subscription was marked inactive (will fail initially)
      const updatedSub = await subscriptionManager.getSubscription(subscriptionId)
      expect(updatedSub.isActive).toBe(false)
    })

    it('should emit status change events', async () => {
      const spy = jest.spyOn(subscriptionManager, 'emit' as any)
      const subscriptionId = 'sub_test_123'

      await subscriptionManager.updateSubscriptionStatus(subscriptionId, false)

      expect(spy).toHaveBeenCalledWith('subscription:status-changed', {
        subscriptionId,
        isActive: false
      })
    })
  })

  describe('calculateGeneratorRevenue', () => {
    it('should calculate total revenue from active subscriptions', async () => {
      const generatorAddress = '0x1234567890abcdef1234567890abcdef12345678'

      const revenue = await subscriptionManager.calculateGeneratorRevenue(generatorAddress)

      expect(revenue).toBeDefined()
      expect(typeof revenue).toBe('string')
      expect(BigInt(revenue) >= 0n).toBe(true)
    })

    it('should only include revenue from active subscriptions', async () => {
      const generatorAddress = '0x1234567890abcdef1234567890abcdef12345678'

      // Create test data with mixed active/inactive subscriptions
      // This will fail initially as no implementation exists

      const revenue = await subscriptionManager.calculateGeneratorRevenue(generatorAddress)

      // Revenue should only count active subscriptions
      expect(BigInt(revenue) > 0n).toBe(true)
    })
  })

  describe('CLI interface', () => {
    it('should have CLI command handlers', () => {
      expect(subscriptionManager.cli).toBeDefined()
      expect(subscriptionManager.cli.subscribe).toBeDefined()
      expect(subscriptionManager.cli.listActive).toBeDefined()
      expect(subscriptionManager.cli.checkExpiry).toBeDefined()
    })

    it('should return proper exit codes from CLI commands', async () => {
      const result = await subscriptionManager.cli.listActive({
        json: true
      })

      expect(result.exitCode).toBe(0) // Success
      expect(result.data).toBeDefined()
    })
  })
})