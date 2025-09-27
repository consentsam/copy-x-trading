import { db } from '@/db/db'
import { strategies, type Strategy, type NewStrategy } from '@/db/schema/strategies-schema'
import { eq, and, desc, sql } from 'drizzle-orm'

export class StrategyModel {
  // Create a new strategy
  static async create(data: NewStrategy): Promise<Strategy> {
    const [strategy] = await db.insert(strategies).values(data).returning()
    return strategy
  }

  // Get all strategies
  static async findAll(isActive?: boolean): Promise<Strategy[]> {
    const conditions = []
    if (isActive !== undefined) {
      conditions.push(eq(strategies.isActive, isActive))
    }

    return await db
      .select()
      .from(strategies)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(strategies.createdAt))
  }

  // Get strategy by ID
  static async findById(id: string): Promise<Strategy | null> {
    const [strategy] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.strategyId, id))
      .limit(1)

    return strategy || null
  }

  // Get strategies by wallet address
  static async findByWallet(walletAddress: string): Promise<Strategy[]> {
    // Normalize address for consistent querying
    const normalizedAddress = walletAddress.toLowerCase()
    return await db
      .select()
      .from(strategies)
      .where(eq(strategies.alphaGeneratorAddress, normalizedAddress))
      .orderBy(desc(strategies.createdAt))
  }

  // Update strategy
  static async update(id: string, data: Partial<NewStrategy>): Promise<Strategy | null> {
    const [strategy] = await db
      .update(strategies)
      .set(data)
      .where(eq(strategies.strategyId, id))
      .returning()

    return strategy || null
  }

  // Delete strategy (soft delete by setting isActive to false)
  static async softDelete(id: string): Promise<boolean> {
    const [result] = await db
      .update(strategies)
      .set({ isActive: false })
      .where(eq(strategies.strategyId, id))
      .returning()

    return !!result
  }

  static async getExecutionStats(strategyId: string) {
    // Query protocol_trade_confirmations through trade_broadcasts
    const result = await db.execute(sql`
      SELECT
        COUNT(DISTINCT tc.id) as total_trades,
        SUM(CASE WHEN tc.status = 'EXECUTED' THEN 1 ELSE 0 END) as executed_trades,
        SUM(CASE WHEN tc.status = 'PENDING' THEN 1 ELSE 0 END) as pending_trades
      FROM trade_broadcasts tb
      LEFT JOIN protocol_trade_confirmations tc ON tb.id = tc.trade_broadcast_id
      WHERE tb.strategy_id = ${strategyId}
    `)

    const stats = result.rows[0] || { total_trades: 0, executed_trades: 0, pending_trades: 0 }
    const totalTrades = Number(stats.total_trades ?? 0)
    const executedTrades = Number(stats.executed_trades ?? 0)
    const pendingTrades = Number(stats.pending_trades ?? 0)
    const executionRate = totalTrades > 0
      ? Math.round((executedTrades / totalTrades) * 100)
      : 0

    return {
      totalTrades,
      executedTrades,
      pendingTrades,
      executionRate,
    }
  }
}
