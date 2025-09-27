import { db } from '@/db/db';
import { alphaGeneratorsTable } from '@/db/schema/alpha-generators-schema';
import { eq } from 'drizzle-orm';

const generatorAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

async function checkAndCreateGenerator() {
  // Check if generator exists
  const generators = await db
    .select()
    .from(alphaGeneratorsTable)
    .where(eq(alphaGeneratorsTable.generatorAddress, generatorAddress));

  if (generators.length === 0) {
    console.log('Generator not found. Creating...');

    // Create the generator
    const [newGenerator] = await db
      .insert(alphaGeneratorsTable)
      .values({
        generatorAddress,
        name: 'Test AlphaGenerator',
        description: 'Test AlphaGenerator for protocol strategy integration',
        isActive: true,
        feePercentage: '2.5',
        encryptionSupport: true,
      })
      .returning();

    console.log('Generator created:', newGenerator.generatorId);
  } else {
    console.log('Generator exists. Is active:', generators[0].isActive);

    if (!generators[0].isActive) {
      // Activate the generator
      await db
        .update(alphaGeneratorsTable)
        .set({ isActive: true })
        .where(eq(alphaGeneratorsTable.generatorAddress, generatorAddress));

      console.log('Generator activated');
    }
  }

  process.exit(0);
}

checkAndCreateGenerator().catch(console.error);