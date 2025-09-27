import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as strategiesSchema from '@/db/schema/strategies-schema'
import * as subscriptionsSchema from '@/db/schema/subscriptions-schema'

// Database configuration
export const dbConfig = {
  database: 'alphaengine',
  tables: {
    strategies: 'strategies',
    subscriptions: 'subscriptions',
    tradeConfirmations: 'trade_confirmations'
  },
  indexes: [
    'idx_strategies_wallet_address',
    'idx_strategies_is_active',
    'idx_subscriptions_strategy_id',
    'idx_subscriptions_subscriber_wallet',
    'idx_subscriptions_is_active',
    'idx_trade_confirmations_strategy_id',
    'idx_trade_confirmations_trade_hash',
    'idx_trade_confirmations_broadcast_status',
    'idx_trade_confirmations_timestamp'
  ],
  poolConfig: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
}

// Create database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...dbConfig.poolConfig,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

// Create Drizzle ORM instance with all schemas
export const db = drizzle(pool, {
  schema: {
    ...strategiesSchema,
    ...subscriptionsSchema
  }
})

// Export pool for direct queries if needed
export { pool }

// Database health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()')
    console.log('✅ Database connected at:', result.rows[0].now)
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await pool.end()
    console.log('✅ Database connection pool closed')
  } catch (error) {
    console.error('❌ Error closing database pool:', error)
  }
}