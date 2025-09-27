import { db } from '../db/schema/db.js';
import { strategiesTable, subscriptionsTable, tradeConfirmationsTable } from '../db/schema/index.js';

// Sample wallet addresses for testing
const sampleAddresses = {
  generators: [
    '0x742d35Cc6135C52dE9c5dB5c5C4F3EfD9BcC23Bf',  // Alpha Generator 1
    '0x8ba1f109551bD432803012645Hac136c05cF3B1',  // Alpha Generator 2
    '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5',  // Alpha Generator 3
  ],
  consumers: [
    '0x742d35Cc6135C52dE9c5dB5c5C4F3EfD9BcC23Bf',  // Same as generator (can be both)
    '0x8ba1f109551bD432803012645Hac136c05cF3B1',  // Same as generator (can be both)
    '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5',  // Same as generator (can be both)
    '0x1234567890123456789012345678901234567890',  // Consumer only 1
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',  // Consumer only 2
  ]
};

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await db.delete(tradeConfirmationsTable);
    await db.delete(subscriptionsTable);
    await db.delete(strategiesTable);

    // Seed strategies
    console.log('📊 Seeding strategies...');
    const strategies = await db.insert(strategiesTable).values([
      {
        strategyName: 'ETH Momentum Pro',
        strategyDescription: 'Advanced momentum trading strategy focusing on ETH price movements with technical indicators and risk management.',
        supportedProtocols: ['ethereum', 'uniswap'],
        strategyJSON: {
          indicators: ['RSI', 'MACD', 'EMA'],
          riskLevel: 'medium',
          targetAssets: ['ETH', 'WETH']
        },
        alphaGeneratorAddress: sampleAddresses.generators[0],
        subscriberCount: 8
      },
      {
        strategyName: 'DeFi Yield Maximizer',
        strategyDescription: 'Optimized yield farming strategy across multiple DeFi protocols to maximize returns while minimizing impermanent loss.',
        supportedProtocols: ['ethereum', 'polygon', 'arbitrum'],
        strategyJSON: {
          protocols: ['Aave', 'Compound', 'Uniswap V3'],
          rebalanceFrequency: 'daily',
          riskLevel: 'low'
        },
        alphaGeneratorAddress: sampleAddresses.generators[1],
        subscriberCount: 15
      },
      {
        strategyName: 'BTC Scalping Alpha',
        strategyDescription: 'High-frequency scalping strategy for BTC with rapid entry/exit signals based on order book analysis.',
        supportedProtocols: ['bitcoin', 'lightning'],
        strategyJSON: {
          timeframe: '1m',
          indicators: ['Bollinger Bands', 'Volume Profile'],
          riskLevel: 'high'
        },
        alphaGeneratorAddress: sampleAddresses.generators[2],
        subscriberCount: 3
      },
      {
        strategyName: 'Stablecoin Arbitrage',
        strategyDescription: 'Cross-chain arbitrage opportunities between different stablecoin pairs and DEXes.',
        supportedProtocols: ['ethereum', 'bsc', 'polygon'],
        strategyJSON: {
          targetPairs: ['USDC/USDT', 'DAI/USDC', 'BUSD/USDT'],
          minProfitThreshold: '0.1%',
          riskLevel: 'very_low'
        },
        alphaGeneratorAddress: sampleAddresses.generators[0],
        subscriberCount: 22
      },
      {
        strategyName: 'Altcoin Trend Follower',
        strategyDescription: 'Multi-altcoin trend following strategy with dynamic position sizing and stop-loss management.',
        supportedProtocols: ['ethereum', 'bsc'],
        strategyJSON: {
          targetTokens: ['LINK', 'UNI', 'AAVE', 'CRV'],
          trendStrength: 'strong',
          riskLevel: 'medium_high'
        },
        alphaGeneratorAddress: sampleAddresses.generators[1],
        subscriberCount: 11
      }
    ]).returning();

    console.log(`✅ Created ${strategies.length} strategies`);

    // Seed subscriptions
    console.log('🔔 Seeding subscriptions...');
    const subscriptions = [];
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      // Subscribe 2-4 random consumers to each strategy
      const subscriberCount = Math.min(strategy.subscriberCount, sampleAddresses.consumers.length);
      const shuffledConsumers = sampleAddresses.consumers.sort(() => 0.5 - Math.random());

      for (let j = 0; j < subscriberCount; j++) {
        subscriptions.push({
          strategyId: strategy.strategyId,
          alphaConsumerAddress: shuffledConsumers[j],
          subscriptionTxHash: `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`,
        });
      }
    }

    await db.insert(subscriptionsTable).values(subscriptions);
    console.log(`✅ Created ${subscriptions.length} subscriptions`);

    // Seed trade confirmations
    console.log('⏳ Seeding trade confirmations...');
    const tradeConfirmations = [];

    // Create some pending trade confirmations for consumers to review
    for (let i = 0; i < 8; i++) {
      const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
      const randomConsumer = sampleAddresses.consumers[Math.floor(Math.random() * sampleAddresses.consumers.length)];

      tradeConfirmations.push({
        strategyId: randomStrategy.strategyId,
        alphaConsumerAddress: randomConsumer,
        executionParams: {
          action: Math.random() > 0.5 ? 'buy' : 'sell',
          asset: ['ETH', 'BTC', 'USDC', 'DAI'][Math.floor(Math.random() * 4)],
          amount: (Math.random() * 2 + 0.1).toFixed(4),
          maxSlippage: '1.5%',
          deadline: Date.now() + 3600000 // 1 hour
        },
        gasEstimate: (Math.random() * 150000 + 21000).toFixed(0),
        isExecuted: Math.random() > 0.6, // 40% pending, 60% executed
        executionTxHash: Math.random() > 0.6 ? `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}` : null
      });
    }

    await db.insert(tradeConfirmationsTable).values(tradeConfirmations);
    console.log(`✅ Created ${tradeConfirmations.length} trade confirmations`);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Seeded data summary:');
    console.log(`- ${strategies.length} strategies`);
    console.log(`- ${subscriptions.length} subscriptions`);
    console.log(`- ${tradeConfirmations.length} trade confirmations`);

    console.log('\n🔍 Frontend should now display:');
    console.log('- Real strategies on browse/dashboard pages');
    console.log('- Actual subscription data');
    console.log('- Pending trade confirmations');
    console.log('- Live subscriber counts');
    console.log('- Performance metrics from real data');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding
seedDatabase();