/**
 * @file subscription-expiry.ts
 * @description Cron job to check for expired subscriptions and mark them as inactive
 * Runs at :00 every hour in UTC
 */

import { db } from '@/db/db'
import { subscriptionsTable } from '@/db/schema/subscriptions-schema'
import { eq, and, lt } from 'drizzle-orm'
import { subscriptionManager } from '../libraries/subscription-manager'

/**
 * Check for expired subscriptions and mark them as inactive
 * Emits expiry events for downstream processing
 */
export async function processExpiredSubscriptions(): Promise<number> {
  console.log(`[${new Date().toISOString()}] Starting subscription expiry check...`)

  const now = new Date()

  try {
    // Find all active subscriptions that have expired
    const expiredSubscriptions = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.isActive, true),
          lt(subscriptionsTable.expiresAt, now)
        )
      )

    let processedCount = 0

    for (const subscription of expiredSubscriptions) {
      try {
        // Update subscription status to inactive
        await db
          .update(subscriptionsTable)
          .set({
            isActive: false,
            updatedAt: now
          })
          .where(eq(subscriptionsTable.subscriptionId, subscription.subscriptionId))

        // Emit expiry event through subscription manager
        subscriptionManager.emit('subscription:expired', {
          subscriptionId: subscription.subscriptionId,
          alphaGeneratorAddress: subscription.alphaGeneratorAddress,
          alphaConsumerAddress: subscription.alphaConsumerAddress,
          expiresAt: subscription.expiresAt,
          processedAt: now
        })

        processedCount++
        console.log(`Expired subscription: ${subscription.subscriptionId}`)
      } catch (error: any) {
        console.error(`Failed to expire subscription ${subscription.subscriptionId}:`, error.message)
      }
    }

    console.log(`[${new Date().toISOString()}] Processed ${processedCount} expired subscriptions`)
    return processedCount
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error during expiry check:`, error.message)
    throw error
  }
}

/**
 * Cron job scheduler function
 * Should be called by the system cron scheduler every hour at :00
 */
export async function runExpiryJob(): Promise<void> {
  const startTime = Date.now()

  try {
    const processedCount = await processExpiredSubscriptions()
    const duration = Date.now() - startTime

    console.log(`Expiry job completed in ${duration}ms, processed ${processedCount} subscriptions`)
  } catch (error: any) {
    console.error('Expiry job failed:', error.message)
    throw error
  }
}

/**
 * Manual execution function for testing/debugging
 */
export async function runExpiryJobManually(): Promise<{ processedCount: number; duration: number }> {
  const startTime = Date.now()

  try {
    const processedCount = await processExpiredSubscriptions()
    const duration = Date.now() - startTime

    return { processedCount, duration }
  } catch (error: any) {
    console.error('Manual expiry job failed:', error.message)
    throw error
  }
}