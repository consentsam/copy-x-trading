import { db } from '@/db/db'
import { subscriptions, type Subscription, type NewSubscription } from '@/db/schema/subscriptions-schema'
import { strategies } from '@/db/schema/strategies-schema'
import { eq, and, desc } from 'drizzle-orm'

export class SubscriptionModel {
  // Create a new subscription
  static async create(data: NewSubscription): Promise<Subscription> {
    const [subscription] = await db.insert(subscriptions).values(data).returning()
    return subscription
  }

  // Get all subscriptions for a strategy
  static async findByStrategy(strategyId: string, isActive?: boolean): Promise<Subscription[]> {
    const conditions = [eq(subscriptions.strategyId, strategyId)]
    if (isActive !== undefined) {
      conditions.push(eq(subscriptions.isActive, isActive))
    }

    return await db
      .select()
      .from(subscriptions)
      .where(and(...conditions))
      .orderBy(desc(subscriptions.createdAt))
  }

  // Get all subscriptions for a subscriber
  static async findBySubscriber(subscriberWallet: string, isActive?: boolean): Promise<Subscription[]> {
    const conditions = [eq(subscriptions.alphaConsumerAddress, subscriberWallet)]
    if (isActive !== undefined) {
      conditions.push(eq(subscriptions.isActive, isActive))
    }

    return await db
      .select()
      .from(subscriptions)
      .where(and(...conditions))
      .orderBy(desc(subscriptions.createdAt))
  }

  // Get a specific subscription
  static async findOne(strategyId: string, subscriberWallet: string): Promise<Subscription | null> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.strategyId, strategyId),
          eq(subscriptions.alphaConsumerAddress, subscriberWallet)
        )
      )
      .limit(1)

    return subscription || null
  }

  // Get subscriptions with strategy details
  static async findWithStrategy(subscriberWallet: string): Promise<any[]> {
    return await db
      .select({
        subscription: subscriptions,
        strategy: strategies,
      })
      .from(subscriptions)
      .innerJoin(strategies, eq(subscriptions.strategyId, strategies.id))
      .where(eq(subscriptions.alphaConsumerAddress, subscriberWallet))
      .orderBy(desc(subscriptions.createdAt))
  }

  // Update subscription
  static async update(id: string, data: Partial<NewSubscription>): Promise<Subscription | null> {
    const [subscription] = await db
      .update(subscriptions)
      .set(data)
      .where(eq(subscriptions.subscriptionId, id))
      .returning()

    return subscription || null
  }

  // Unsubscribe (soft delete)
  static async unsubscribe(strategyId: string, subscriberWallet: string): Promise<boolean> {
    const [result] = await db
      .update(subscriptions)
      .set({ isActive: false })
      .where(
        and(
          eq(subscriptions.strategyId, strategyId),
          eq(subscriptions.alphaConsumerAddress, subscriberWallet)
        )
      )
      .returning()

    return !!result
  }
}