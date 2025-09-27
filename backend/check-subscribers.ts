import { db } from '@/db/db';
import { subscriptionsTable } from '@/db/schema/subscriptions-schema';
import { eq, and } from 'drizzle-orm';

const generatorAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

async function checkSubscribers() {
  // Check if generator has any subscribers
  const subscriptions = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.alphaGeneratorAddress, generatorAddress),
        eq(subscriptionsTable.isActive, true)
      )
    );

  console.log('Active subscribers:', subscriptions.length);

  if (subscriptions.length === 0) {
    console.log('No subscribers found. Creating test subscriber...');

    // Create a test subscription
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);  // 30 days from now
    const [newSubscription] = await db
      .insert(subscriptionsTable)
      .values({
        alphaGeneratorAddress: generatorAddress,
        alphaConsumerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',  // Test consumer address
        encryptedConsumerAddress: 'encrypted_0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',  // Mock encrypted
        subscriptionAmount: '1000000000000000000',  // 1 ETH in wei
        isActive: true,
        expiresAt: expiryDate,  // Use expires_at field
      })
      .returning();

    console.log('Test subscription created:', newSubscription.subscriptionId);
  } else {
    console.log('Subscribers found:');
    subscriptions.forEach(sub => {
      console.log('  -', sub.alphaConsumerAddress || sub.encryptedConsumerAddress);
    });
  }

  process.exit(0);
}

checkSubscribers().catch(console.error);