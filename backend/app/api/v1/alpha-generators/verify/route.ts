import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { subscriptionsTable } from '@/db/schema/subscriptions-schema';
import { alphaGeneratorsTable } from '@/db/schema/alpha-generators-schema';
import { eq, and } from 'drizzle-orm';
import { ethers } from 'ethers';
import { z } from 'zod';

const VerifySchema = z.object({
  generatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  subscriberAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const validation = VerifySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validation.error.issues,
      }, { status: 400 });
    }
    
    const { generatorAddress, subscriberAddress } = validation.data;
    
    if (!ethers.isAddress(generatorAddress) || !ethers.isAddress(subscriberAddress)) {
      return NextResponse.json({
        error: 'Invalid address format',
      }, { status: 400 });
    }
    
    const [subscription] = await db
      .select({
        subscriptionId: subscriptionsTable.subscriptionId,
        alphaGeneratorAddress: subscriptionsTable.alphaGeneratorAddress,
        alphaConsumerAddress: subscriptionsTable.alphaConsumerAddress,
        encryptedConsumerAddress: subscriptionsTable.encryptedConsumerAddress,
        subscriptionType: subscriptionsTable.subscriptionType,
        isActive: subscriptionsTable.isActive,
        createdAt: subscriptionsTable.createdAt,
        generator: {
          name: alphaGeneratorsTable.name,
          description: alphaGeneratorsTable.description,
          feePercentage: alphaGeneratorsTable.feePercentage,
          performanceStats: alphaGeneratorsTable.performanceStats,
        },
      })
      .from(subscriptionsTable)
      .leftJoin(
        alphaGeneratorsTable,
        eq(subscriptionsTable.alphaGeneratorAddress, alphaGeneratorsTable.generatorAddress)
      )
      .where(
        and(
          eq(subscriptionsTable.alphaGeneratorAddress, generatorAddress),
          eq(subscriptionsTable.alphaConsumerAddress, subscriberAddress),
          eq(subscriptionsTable.isActive, true)
        )
      )
      .limit(1);
    
    if (!subscription) {
      return NextResponse.json({
        valid: false,
        message: 'No active subscription found',
      }, { status: 200 });
    }
    
    return NextResponse.json({
      valid: true,
      data: subscription,
      message: 'Active subscription verified',
    }, { status: 200 });
  } catch (error: any) {
    console.error('[VerifySubscription] Error:', error);
    return NextResponse.json({
      error: 'Failed to verify subscription',
      details: error.message,
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const generatorAddress = searchParams.get('generator');
    const subscriberAddress = searchParams.get('subscriber');
    
    if (!generatorAddress || !subscriberAddress) {
      return NextResponse.json({
        error: 'Both generator and subscriber addresses are required',
      }, { status: 400 });
    }
    
    if (!ethers.isAddress(generatorAddress) || !ethers.isAddress(subscriberAddress)) {
      return NextResponse.json({
        error: 'Invalid address format',
      }, { status: 400 });
    }
    
    const [subscription] = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.alphaGeneratorAddress, generatorAddress),
          eq(subscriptionsTable.alphaConsumerAddress, subscriberAddress)
        )
      )
      .limit(1);
    
    if (!subscription) {
      return NextResponse.json({
        valid: false,
        message: 'No subscription found',
      }, { status: 200 });
    }
    
    return NextResponse.json({
      valid: subscription.isActive || false,
      data: subscription,
      message: subscription.isActive ? 'Active subscription' : 'Inactive subscription',
    }, { status: 200 });
  } catch (error: any) {
    console.error('[VerifySubscription] GET error:', error);
    return NextResponse.json({
      error: 'Failed to verify subscription',
      details: error.message,
    }, { status: 500 });
  }
}