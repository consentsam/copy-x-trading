const { db } = require('./db/db');
const { strategiesTable } = require('./db/schema/strategies-schema');

async function seedStrategy() {
  try {
    const strategy = await db
      .insert(strategiesTable)
      .values({
        strategyName: 'Test Generator Strategy',
        strategyDescription: 'Strategy for Test Generator to enable subscription testing',
        supportedProtocols: ['Uniswap'],
        strategyJSON: {
          name: 'Test Strategy',
          version: '1.0',
          steps: [
            {
              pair: 'ETH/USDC',
              action: 'monitor',
              protocol: 'uniswap'
            }
          ]
        },
        alphaGeneratorAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
        isActive: true,
      })
      .returning();

    console.log('Created strategy:', strategy);
    process.exit(0);
  } catch (error) {
    console.error('Error creating strategy:', error);
    process.exit(1);
  }
}

seedStrategy();