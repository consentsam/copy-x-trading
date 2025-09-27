/**
 * @file strategy-propagator/index.ts
 * @description Strategy propagation service using Server-Sent Events (SSE)
 * Handles broadcasting strategies to active subscribers with recovery mechanism
 */

import { db } from '@/db/db'
import { strategyDeliveriesTable } from '@/db/schema/strategy-deliveries-schema'
import { subscriptionsTable } from '@/db/schema/subscriptions-schema'
import { eq, and, gte, lt, lte } from 'drizzle-orm'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'

export interface Strategy {
  strategyId: string
  strategyName: string
  tradingParameters: any
  alphaGeneratorAddress: string
}

export interface DeliveryResult {
  consumerAddress: string
  status: 'delivered' | 'failed' | 'queued'
  deliveryId: string
  error?: string
}

export interface BroadcastOptions {
  strategy: Strategy
  subscribers?: string[]
}

export interface CLIResult {
  exitCode: number
  data?: any
  deliveryResults?: DeliveryResult[]
  error?: string
}

/**
 * StrategyPropagator - Handles strategy broadcasting to subscribers
 */
export class StrategyPropagator extends EventEmitter {
  private sseConnections: Map<string, any> = new Map()
  private maxRetries = 3

  /**
   * Broadcast a strategy to all active subscribers
   */
  async broadcast(options: BroadcastOptions): Promise<DeliveryResult[]> {
    const { strategy, subscribers } = options
    const results: DeliveryResult[] = []
    const startTime = Date.now()

    // Get target subscribers and their subscription IDs
    let targetSubscribers: string[] = []
    const subscriptionMap = new Map<string, string>()  // consumerAddress -> subscriptionId

    if (subscribers) {
      targetSubscribers = subscribers
      // For manually specified subscribers, we need to fetch their subscription IDs
      const now = new Date()
      const subscriptions = await db
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.alphaGeneratorAddress, strategy.alphaGeneratorAddress),
            eq(subscriptionsTable.isActive, true),
            gte(subscriptionsTable.expiresAt, now)
          )
        )

      for (const sub of subscriptions) {
        if (subscribers.includes(sub.alphaConsumerAddress)) {
          subscriptionMap.set(sub.alphaConsumerAddress, sub.subscriptionId)
        }
      }
    } else {
      // Get all active subscribers for this generator
      const now = new Date()
      const activeSubscriptions = await db
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.alphaGeneratorAddress, strategy.alphaGeneratorAddress),
            eq(subscriptionsTable.isActive, true),
            gte(subscriptionsTable.expiresAt, now)
          )
        )

      for (const sub of activeSubscriptions) {
        targetSubscribers.push(sub.alphaConsumerAddress)
        subscriptionMap.set(sub.alphaConsumerAddress, sub.subscriptionId)
      }
    }

    // Broadcast to each subscriber
    for (const consumerAddress of targetSubscribers) {
      const deliveryId = `delivery_${randomUUID()}`
      const subscriptionId = subscriptionMap.get(consumerAddress)
      let status: 'delivered' | 'failed' | 'queued' = 'queued'
      let error: string | undefined

      // Skip if no subscription ID found (shouldn't happen, but safety check)
      if (!subscriptionId) {
        console.warn(`No subscription ID found for consumer ${consumerAddress}`)
        continue
      }

      try {
        const connection = this.sseConnections.get(consumerAddress)

        if (connection) {
          // Send via SSE
          const data = JSON.stringify(strategy)
          connection.write(`data: ${data}\n\n`)
          status = 'delivered'

          // Record successful delivery with REAL subscription ID
          await db
            .insert(strategyDeliveriesTable)
            .values({
              deliveryId,
              strategyId: strategy.strategyId,
              subscriptionId,  // Use real subscription ID
              consumerAddress,
              deliveredAt: new Date(),
              deliveryStatus: 'delivered'
            })
        } else {
          // Queue for later delivery with REAL subscription ID
          await db
            .insert(strategyDeliveriesTable)
            .values({
              deliveryId,
              strategyId: strategy.strategyId,
              subscriptionId,  // Use real subscription ID
              consumerAddress,
              deliveryStatus: 'queued'
            })
          status = 'queued'
        }
      } catch (err: any) {
        status = 'failed'
        error = err.message

        // Record failed delivery with REAL subscription ID
        await db
          .insert(strategyDeliveriesTable)
          .values({
            deliveryId,
            strategyId: strategy.strategyId,
            subscriptionId,  // Use real subscription ID
            consumerAddress,
            deliveryStatus: 'failed',
            errorDetails: { error: err.message }
          })
      }

      results.push({
        consumerAddress,
        status,
        deliveryId,
        error
      })
    }

    // Emit broadcast event
    this.emit('strategy:broadcast', {
      strategyId: strategy.strategyId,
      subscriberCount: targetSubscribers.length,
      results
    })

    // Check 5-second performance requirement
    const broadcastTime = (Date.now() - startTime) / 1000
    if (broadcastTime > 5) {
      console.warn(`Broadcast took ${broadcastTime} seconds, exceeding 5-second requirement`)
    }

    return results
  }

  /**
   * Queue strategy delivery for specific subscribers
   */
  async queueDelivery(
    strategyId: string,
    subscriberAddresses: string[],
    generatorAddress?: string
  ): Promise<void> {
    // Fetch actual subscription IDs for these subscribers
    const now = new Date()
    const subscriptions = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.isActive, true),
          gte(subscriptionsTable.expiresAt, now),
          ...(generatorAddress ? [eq(subscriptionsTable.alphaGeneratorAddress, generatorAddress)] : [])
        )
      )

    const subscriptionMap = new Map<string, string>()
    for (const sub of subscriptions) {
      if (subscriberAddresses.includes(sub.alphaConsumerAddress)) {
        subscriptionMap.set(sub.alphaConsumerAddress, sub.subscriptionId)
      }
    }

    for (const consumerAddress of subscriberAddresses) {
      const subscriptionId = subscriptionMap.get(consumerAddress)

      // Only queue if we have a valid subscription ID
      if (!subscriptionId) {
        console.warn(`No active subscription found for consumer ${consumerAddress}, skipping queueDelivery`)
        continue
      }

      const deliveryId = `delivery_${randomUUID()}`

      await db
        .insert(strategyDeliveriesTable)
        .values({
          deliveryId,
          strategyId,
          subscriptionId,  // Use real subscription ID
          consumerAddress,
          deliveryStatus: 'queued'
        })
    }
  }

  /**
   * Get missed strategies for a consumer since a specific time
   */
  async getMissedStrategies(
    consumerAddress: string,
    since: Date
  ): Promise<Strategy[]> {
    // Get active subscriptions for this consumer
    const now = new Date()
    const activeSubscriptions = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.alphaConsumerAddress, consumerAddress),
          eq(subscriptionsTable.isActive, true),
          gte(subscriptionsTable.expiresAt, now)
        )
      )

    // Get queued or failed deliveries for this consumer since the given time
    const missedDeliveries = await db
      .select()
      .from(strategyDeliveriesTable)
      .where(
        and(
          eq(strategyDeliveriesTable.consumerAddress, consumerAddress),
          gte(strategyDeliveriesTable.scheduledAt, since),
          eq(strategyDeliveriesTable.deliveryStatus, 'queued')
        )
      )

    // Convert to Strategy format (simplified for MVP)
    const strategies: Strategy[] = missedDeliveries.map(delivery => ({
      strategyId: delivery.strategyId,
      strategyName: `Strategy ${delivery.strategyId}`,
      tradingParameters: {},
      alphaGeneratorAddress: activeSubscriptions[0]?.alphaGeneratorAddress || ''
    }))

    return strategies
  }

  /**
   * Retry failed strategy deliveries
   */
  async retryFailed(): Promise<number> {
    const failedDeliveries = await db
      .select()
      .from(strategyDeliveriesTable)
      .where(
        and(
          eq(strategyDeliveriesTable.deliveryStatus, 'failed'),
          lt(strategyDeliveriesTable.retryCount, this.maxRetries)
        )
      )

    let retriedCount = 0

    for (const delivery of failedDeliveries) {
      const connection = this.sseConnections.get(delivery.consumerAddress)

      if (connection) {
        try {
          // Attempt redelivery
          const strategyData = {
            strategyId: delivery.strategyId,
            strategyName: `Strategy ${delivery.strategyId}`,
            tradingParameters: {},
            alphaGeneratorAddress: ''
          }

          connection.write(`data: ${JSON.stringify(strategyData)}\n\n`)

          // Update delivery status
          await db
            .update(strategyDeliveriesTable)
            .set({
              deliveryStatus: 'delivered',
              deliveredAt: new Date(),
              retryCount: delivery.retryCount + 1
            })
            .where(eq(strategyDeliveriesTable.deliveryId, delivery.deliveryId))

          this.emit('delivery:success', delivery)
          retriedCount++
        } catch (error: any) {
          // Update retry count
          await db
            .update(strategyDeliveriesTable)
            .set({
              retryCount: delivery.retryCount + 1,
              errorDetails: { ...delivery.errorDetails, lastError: error.message }
            })
            .where(eq(strategyDeliveriesTable.deliveryId, delivery.deliveryId))

          this.emit('delivery:retry', delivery)
        }
      }
    }

    return retriedCount
  }

  /**
   * Register SSE connection for a consumer
   */
  registerConnection(consumerAddress: string, connection: any): void {
    this.sseConnections.set(consumerAddress, connection)
  }

  /**
   * Unregister SSE connection
   */
  unregisterConnection(consumerAddress: string): void {
    this.sseConnections.delete(consumerAddress)
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.sseConnections.size
  }

  /**
   * Check if consumer is connected
   */
  isConnected(consumerAddress: string): boolean {
    return this.sseConnections.has(consumerAddress)
  }

  /**
   * Get queued delivery count
   */
  async getQueuedCount(): Promise<number> {
    const queued = await db
      .select()
      .from(strategyDeliveriesTable)
      .where(eq(strategyDeliveriesTable.deliveryStatus, 'queued'))

    return queued.length
  }

  /**
   * Get deliveries for a strategy
   */
  async getDeliveries(strategyId: string): Promise<any[]> {
    const deliveries = await db
      .select()
      .from(strategyDeliveriesTable)
      .where(eq(strategyDeliveriesTable.strategyId, strategyId))

    return deliveries
  }

  /**
   * Get failed deliveries
   */
  async getFailedDeliveries(): Promise<any[]> {
    const failed = await db
      .select()
      .from(strategyDeliveriesTable)
      .where(eq(strategyDeliveriesTable.deliveryStatus, 'failed'))

    return failed
  }

  /**
   * Get delivery status for a specific delivery
   */
  async getDeliveryStatus(deliveryId: string): Promise<any> {
    const [delivery] = await db
      .select()
      .from(strategyDeliveriesTable)
      .where(eq(strategyDeliveriesTable.deliveryId, deliveryId))
      .limit(1)

    if (!delivery) {
      return {
        deliveryId,
        deliveryStatus: 'not_found'
      }
    }

    return delivery
  }

  /**
   * Check delivery health for a consumer
   */
  async checkDeliveryHealth(consumerAddress: string): Promise<{
    connected: boolean
    missedStrategies: number
    lastDelivery?: Date
  }> {
    const connected = this.isConnected(consumerAddress)

    // Count missed strategies
    const missedCount = await db
      .select()
      .from(strategyDeliveriesTable)
      .where(
        and(
          eq(strategyDeliveriesTable.consumerAddress, consumerAddress),
          eq(strategyDeliveriesTable.deliveryStatus, 'queued')
        )
      )

    // Get last successful delivery
    const lastDeliveries = await db
      .select()
      .from(strategyDeliveriesTable)
      .where(
        and(
          eq(strategyDeliveriesTable.consumerAddress, consumerAddress),
          eq(strategyDeliveriesTable.deliveryStatus, 'delivered')
        )
      )
      .orderBy(strategyDeliveriesTable.deliveredAt)
      .limit(1)

    return {
      connected,
      missedStrategies: missedCount.length,
      lastDelivery: lastDeliveries[0]?.deliveredAt || undefined
    }
  }

  /**
   * CLI interface for the strategy propagator
   */
  cli = {
    /**
     * Broadcast command
     */
    broadcast: async (args: {
      strategyId: string
    }): Promise<CLIResult> => {
      try {
        // Create mock strategy for testing
        const strategy: Strategy = {
          strategyId: args.strategyId,
          strategyName: `Strategy ${args.strategyId}`,
          tradingParameters: {
            symbol: 'BTC/USDT',
            direction: 'long'
          },
          alphaGeneratorAddress: '0x0000000000000000000000000000000000000000'
        }

        const results = await this.broadcast({ strategy })

        return {
          exitCode: 0,
          deliveryResults: results
        }
      } catch (error: any) {
        return {
          exitCode: 1,
          error: error.message
        }
      }
    },

    /**
     * Check delivery status
     */
    checkDelivery: async (args: {
      consumerAddress: string
      json?: boolean
    }): Promise<CLIResult> => {
      try {
        const health = await this.checkDeliveryHealth(args.consumerAddress)

        return {
          exitCode: 0,
          data: health
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
export const strategyPropagator = new StrategyPropagator()