/**
 * @file subscription-manager/index.ts
 * @description Core subscription lifecycle management library
 * Handles subscription creation, expiry checking, and state management
 */

import { db } from '@/db/db'
import { subscriptionsTable } from '@/db/schema/subscriptions-schema'
import { eq, and, desc, lt, gte } from 'drizzle-orm'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'

export interface SubscriptionOptions {
  generatorAddress: string
  consumerAddress: string
  fee: string // Wei amount as string
  encryptedConsumerAddress?: string
  subscriptionTxHash?: string
}

export interface Subscription {
  subscriptionId: string
  strategyId?: string
  alphaConsumerAddress: string
  alphaGeneratorAddress: string
  subscribedAt: Date
  expiresAt: Date
  isActive: boolean
  metadata: any
}

export interface CLIResult {
  exitCode: number
  data?: any
  error?: string
}

/**
 * SubscriptionManager - Core library for subscription operations
 */
export class SubscriptionManager extends EventEmitter {
  /**
   * Create a new subscription
   */
  async subscribe(options: SubscriptionOptions): Promise<Subscription> {
    const { generatorAddress, consumerAddress, fee, encryptedConsumerAddress, subscriptionTxHash } = options

    // Normalize addresses to lowercase for consistent storage and comparison
    const normalizedGeneratorAddress = generatorAddress.toLowerCase()
    const normalizedConsumerAddress = consumerAddress.toLowerCase()
    const normalizedSubscriptionTxHash = subscriptionTxHash?.toLowerCase()

    // Check for existing active subscription using normalized addresses
    const existing = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.alphaGeneratorAddress, normalizedGeneratorAddress),
          eq(subscriptionsTable.alphaConsumerAddress, normalizedConsumerAddress),
          eq(subscriptionsTable.isActive, true),
          gte(subscriptionsTable.expiresAt, new Date())
        )
      )
      .limit(1)

    if (existing.length > 0) {
      throw new Error('Active subscription already exists')
    }

    // Create new subscription with 30-day expiry
    const subscriptionId = `sub_${randomUUID()}`
    const subscribedAt = new Date()
    const expiresAt = new Date(subscribedAt.getTime() + 30 * 24 * 60 * 60 * 1000)

    const metadata = {
      feeAmount: fee,
      encryptedConsumerAddress,
      ...(normalizedSubscriptionTxHash ? { subscriptionTxHash: normalizedSubscriptionTxHash } : {}),
      createdAt: subscribedAt.toISOString()
    }

    const [subscription] = await db
      .insert(subscriptionsTable)
      .values({
        subscriptionId,
        alphaConsumerAddress: normalizedConsumerAddress,
        alphaGeneratorAddress: normalizedGeneratorAddress,
        subscribedAt,
        expiresAt,
        isActive: true,
        encryptedConsumerAddress,
        subscriptionTxHash: normalizedSubscriptionTxHash,
        metadata
      })
      .returning()

    this.emit('subscription:created', subscription)

    return subscription as Subscription
  }

  /**
   * Check for expired subscriptions and mark them as inactive
   */
  async checkExpiry(): Promise<number> {
    const now = new Date()

    // Find expired active subscriptions
    const expired = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.isActive, true),
          lt(subscriptionsTable.expiresAt, now)
        )
      )

    // Mark them as inactive
    for (const subscription of expired) {
      await db
        .update(subscriptionsTable)
        .set({ isActive: false })
        .where(eq(subscriptionsTable.subscriptionId, subscription.subscriptionId))

      this.emit('subscription:expired', subscription)
    }

    return expired.length
  }

  /**
   * Get active subscriptions for a consumer
   */
  async getActiveSubscriptions(consumerAddress: string): Promise<Subscription[]> {
    const now = new Date()
    const normalizedAddress = consumerAddress.toLowerCase()

    const subscriptions = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.alphaConsumerAddress, normalizedAddress),
          eq(subscriptionsTable.isActive, true),
          gte(subscriptionsTable.expiresAt, now)
        )
      )

    return subscriptions as Subscription[]
  }

  /**
   * Get all subscribers for a generator
   */
  async getGeneratorSubscribers(generatorAddress: string): Promise<Subscription[]> {
    const now = new Date()
    const normalizedAddress = generatorAddress.toLowerCase()

    const subscribers = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.alphaGeneratorAddress, normalizedAddress),
          eq(subscriptionsTable.isActive, true),
          gte(subscriptionsTable.expiresAt, now)
        )
      )

    return subscribers as Subscription[]
  }

  /**
   * Create subscription from blockchain event
   * Handles deduplication and race conditions
   */
  async createFromBlockchainEvent(options: {
    generatorAddress: string
    consumerAddress: string
    subscriptionTxHash: string
    encryptedConsumerAddress?: string
    timestamp: Date
    blockNumber: number
    feeAmount?: string // Add fee amount from transaction value
  }): Promise<Subscription> {
    const { generatorAddress, consumerAddress, subscriptionTxHash, encryptedConsumerAddress, timestamp, blockNumber, feeAmount } = options

    // Normalize addresses and tx hash
    const normalizedGenerator = generatorAddress.toLowerCase()
    const normalizedConsumer = consumerAddress.toLowerCase()
    const normalizedTxHash = subscriptionTxHash.toLowerCase()

    // Check for duplicate by transaction hash (critical for deduplication!)
    const existing = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.subscriptionTxHash, normalizedTxHash))
      .limit(1)

    if (existing.length > 0) {
      console.log('[SubscriptionManager] Duplicate prevented, tx already processed:', normalizedTxHash)
      return existing[0] as Subscription
    }

    // Create subscription with 30-day expiry
    const subscriptionId = `sub_${randomUUID()}`
    const expiresAt = new Date(timestamp.getTime() + 30 * 24 * 60 * 60 * 1000)

    try {
      const [subscription] = await db
        .insert(subscriptionsTable)
        .values({
          subscriptionId,
          alphaConsumerAddress: normalizedConsumer,
          alphaGeneratorAddress: normalizedGenerator,
          subscribedAt: timestamp,
          expiresAt,
          isActive: true,
          encryptedConsumerAddress,
          subscriptionTxHash: normalizedTxHash,
          metadata: {
            source: 'blockchain_event',
            blockNumber,
            feeAmount: feeAmount || '0', // Store fee for revenue calculations
            createdAt: timestamp.toISOString()
          }
        })
        .returning()

      this.emit('subscription:synced-from-chain', subscription)
      console.log('[SubscriptionManager] Subscription created from blockchain event')
      return subscription as Subscription

    } catch (error: any) {
      // Handle unique constraint violation gracefully (PostgreSQL code)
      if (error.code === '23505') {
        console.log('[SubscriptionManager] Race condition handled, fetching existing subscription')
        const [existing] = await db
          .select()
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.subscriptionTxHash, normalizedTxHash))
          .limit(1)
        return existing as Subscription
      }
      throw error
    }
  }

  /**
   * Update subscription status
   */
  async updateSubscriptionStatus(
    subscriptionId: string,
    isActive: boolean
  ): Promise<void> {
    await db
      .update(subscriptionsTable)
      .set({ isActive })
      .where(eq(subscriptionsTable.subscriptionId, subscriptionId))

    this.emit('subscription:status-changed', { subscriptionId, isActive })
  }

  /**
   * Calculate total revenue for a generator
   */
  async calculateGeneratorRevenue(generatorAddress: string): Promise<string> {
    const now = new Date()
    const normalizedAddress = generatorAddress.toLowerCase()

    const activeSubscriptions = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.alphaGeneratorAddress, normalizedAddress),
          eq(subscriptionsTable.isActive, true),
          gte(subscriptionsTable.expiresAt, now)
        )
      )

    let totalRevenue = BigInt(0)

    for (const subscription of activeSubscriptions) {
      if (subscription.metadata?.feeAmount) {
        totalRevenue = totalRevenue + BigInt(subscription.metadata.feeAmount)
      }
    }

    return totalRevenue.toString()
  }

  /**
   * Get a single subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const [subscription] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.subscriptionId, subscriptionId))
      .limit(1)

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`)
    }

    return subscription as Subscription
  }

  /**
   * CLI interface for the subscription manager
   */
  cli = {
    /**
     * Subscribe command
     */
    subscribe: async (args: {
      generatorAddress: string
      consumerAddress: string
      fee?: string
    }): Promise<CLIResult> => {
      try {
        const fee = args.fee || '100000000000000000'
        const subscription = await this.subscribe({
          generatorAddress: args.generatorAddress,
          consumerAddress: args.consumerAddress,
          fee
        })
        return {
          exitCode: 0,
          data: subscription
        }
      } catch (error: any) {
        return {
          exitCode: 1,
          error: error.message
        }
      }
    },

    /**
     * List active subscriptions
     */
    listActive: async (args: {
      consumerAddress?: string
      generatorAddress?: string
      json?: boolean
    }): Promise<CLIResult> => {
      try {
        let subscriptions: Subscription[] = []

        if (args.consumerAddress) {
          subscriptions = await this.getActiveSubscriptions(args.consumerAddress)
        } else if (args.generatorAddress) {
          subscriptions = await this.getGeneratorSubscribers(args.generatorAddress)
        } else {
          // Get all active subscriptions
          const now = new Date()
          const all = await db
            .select()
            .from(subscriptionsTable)
            .where(
              and(
                eq(subscriptionsTable.isActive, true),
                gte(subscriptionsTable.expiresAt, now)
              )
            )
          subscriptions = all as Subscription[]
        }

        return {
          exitCode: 0,
          data: subscriptions
        }
      } catch (error: any) {
        return {
          exitCode: 1,
          error: error.message
        }
      }
    },

    /**
     * Check and update expired subscriptions
     */
    checkExpiry: async (): Promise<CLIResult> => {
      try {
        const expiredCount = await this.checkExpiry()
        return {
          exitCode: 0,
          data: { expiredCount }
        }
      } catch (error: any) {
        return {
          exitCode: 1,
          error: error.message
        }
      }
    }
  }
}

// Export singleton instance
export const subscriptionManager = new SubscriptionManager()
