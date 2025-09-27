require('dotenv').config({ path: '.env.local' });

// Disable TLS certificate validation for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Pool } = require('pg');

// Create connection pool with SSL for DigitalOcean PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function seedAlphaEngineData() {
  try {
    console.log('Connecting to PostgreSQL database...');
    console.log(`Using connection string: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@')}`);

    const client = await pool.connect();

    console.log('Connected successfully. Seeding AlphaEngine data...');

    // Insert sample strategies
    console.log('Adding sample strategies...');
    const strategies = [
      {
        strategyId: '1',
        strategyName: 'ETH-USDC Momentum Strategy',
        strategyDescription: 'Automated momentum trading strategy for ETH-USDC pair',
        supportedProtocols: ['Uniswap', 'Aave', 'Compound'],
        subscriberCount: 15,
        alphaGeneratorAddress: '0x1234567890123456789012345678901234567890',
        isActive: true,
        strategyJSON: {
          version: '1.0',
          steps: [
            { action: 'monitor', target: 'ETH/USDC', threshold: 0.05 },
            { action: 'execute', type: 'buy', amount: 'dynamic' }
          ],
          conditions: { minVolume: 1000000, maxSlippage: 0.02 },
          parameters: { leverage: 2, stopLoss: 0.1 }
        }
      },
      {
        strategyId: '2',
        strategyName: 'DeFi Yield Optimizer',
        strategyDescription: 'Multi-protocol yield farming optimization',
        supportedProtocols: ['Yearn', 'Curve', 'Balancer'],
        subscriberCount: 8,
        alphaGeneratorAddress: '0x0987654321098765432109876543210987654321',
        isActive: true,
        strategyJSON: {
          version: '1.0',
          steps: [
            { action: 'scan', protocols: ['Yearn', 'Curve'], metric: 'APY' },
            { action: 'allocate', strategy: 'proportional' }
          ],
          conditions: { minAPY: 0.05, maxRisk: 'medium' },
          parameters: { rebalanceInterval: 86400 }
        }
      },
      {
        strategyId: '3',
        strategyName: 'Arbitrage Bot Pro',
        strategyDescription: 'Cross-DEX arbitrage opportunity detection and execution',
        supportedProtocols: ['Uniswap', 'SushiSwap', '1inch'],
        subscriberCount: 23,
        alphaGeneratorAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        isActive: true,
        strategyJSON: {
          version: '1.0',
          steps: [
            { action: 'monitor', dexes: ['Uniswap', 'SushiSwap'], pairs: 'all' },
            { action: 'calculate', type: 'arbitrage', minProfit: 0.01 },
            { action: 'execute', type: 'flashloan' }
          ],
          conditions: { minProfit: 100, maxGas: 500000 },
          parameters: { scanInterval: 1000, maxPosition: 10000 }
        }
      },
      {
        strategyId: '4',
        strategyName: 'Liquidity Provider Bot',
        strategyDescription: 'Automated liquidity provision with impermanent loss protection',
        supportedProtocols: ['Uniswap', 'Balancer'],
        subscriberCount: 12,
        alphaGeneratorAddress: '0xfeed1234567890feedbeef1234567890feedbeef',
        isActive: true,
        strategyJSON: {
          version: '1.0',
          steps: [
            { action: 'analyze', metric: 'fees_vs_IL' },
            { action: 'provide', pools: 'optimized' }
          ],
          conditions: { maxIL: 0.05, minFees: 0.03 },
          parameters: { rebalanceThreshold: 0.1 }
        }
      }
    ];

    for (const strategy of strategies) {
      await client.query(`
        INSERT INTO strategies (
          strategy_id,
          strategy_name,
          strategy_description,
          supported_protocols,
          subscriber_count,
          alpha_generator_address,
          is_active,
          strategy_json,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (strategy_id) DO UPDATE SET
          strategy_name = EXCLUDED.strategy_name,
          strategy_description = EXCLUDED.strategy_description,
          supported_protocols = EXCLUDED.supported_protocols,
          subscriber_count = EXCLUDED.subscriber_count,
          is_active = EXCLUDED.is_active,
          strategy_json = EXCLUDED.strategy_json,
          updated_at = NOW();
      `, [
        strategy.strategyId,
        strategy.strategyName,
        strategy.strategyDescription,
        JSON.stringify(strategy.supportedProtocols),
        strategy.subscriberCount,
        strategy.alphaGeneratorAddress,
        strategy.isActive,
        JSON.stringify(strategy.strategyJSON)
      ]);
    }

    // Insert sample subscribers
    console.log('Adding sample subscribers...');
    const subscribers = [
      {
        strategyId: '1',
        consumerAddress: '0xuser1234567890123456789012345678901234567890',
        subscriptionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        feesPaid: '1000000000000000000'
      },
      {
        strategyId: '1',
        consumerAddress: '0xuser2345678901234567890123456789012345678901',
        subscriptionDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000),
        feesPaid: '1000000000000000000'
      },
      {
        strategyId: '2',
        consumerAddress: '0xuser3456789012345678901234567890123456789012',
        subscriptionDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000),
        feesPaid: '500000000000000000'
      }
    ];

    for (const subscriber of subscribers) {
      await client.query(`
        INSERT INTO subscribers (
          strategy_id,
          consumer_address,
          subscription_date,
          expiry_date,
          fees_paid,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (strategy_id, consumer_address) DO UPDATE SET
          subscription_date = EXCLUDED.subscription_date,
          expiry_date = EXCLUDED.expiry_date,
          fees_paid = EXCLUDED.fees_paid;
      `, [
        subscriber.strategyId,
        subscriber.consumerAddress,
        subscriber.subscriptionDate,
        subscriber.expiryDate,
        subscriber.feesPaid
      ]);
    }

    // Insert sample trade confirmations
    console.log('Adding sample trade confirmations...');
    const confirmations = [
      {
        strategyId: '1',
        tradeDetails: {
          action: 'BUY',
          asset: 'ETH',
          amount: '2.5',
          price: '2150.00',
          timestamp: new Date().toISOString()
        },
        consumerAddress: '0xuser1234567890123456789012345678901234567890',
        executed: false
      },
      {
        strategyId: '1',
        tradeDetails: {
          action: 'SELL',
          asset: 'ETH',
          amount: '1.2',
          price: '2180.00',
          timestamp: new Date().toISOString()
        },
        consumerAddress: '0xuser1234567890123456789012345678901234567890',
        executed: true
      }
    ];

    for (const confirmation of confirmations) {
      await client.query(`
        INSERT INTO trade_confirmations (
          strategy_id,
          trade_details,
          consumer_address,
          executed,
          created_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT DO NOTHING;
      `, [
        confirmation.strategyId,
        JSON.stringify(confirmation.tradeDetails),
        confirmation.consumerAddress,
        confirmation.executed
      ]);
    }

    console.log('AlphaEngine data seeding complete!');

    client.release();
  } catch (err) {
    console.error('Error seeding data:', err);
    console.error('Make sure the DATABASE_URL is set in your .env.local file');
  } finally {
    await pool.end();
  }
}

// Run the seed function
seedAlphaEngineData();