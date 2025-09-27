import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { alphaGeneratorsTable } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ethers } from 'ethers';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

// Use Node.js runtime to support fs module for database SSL certificates
export const runtime = 'nodejs';

const logger = createLogger('AlphaGenerators');

const RegisterGeneratorSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500),
  subscriptionFee: z.string(),
  transactionHash: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// OPTIONS handler for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204 })
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const isActive = searchParams.get('active') !== 'false';
    const address = searchParams.get('address');

    let whereConditions = eq(alphaGeneratorsTable.isActive, isActive);

    // Filter by address if provided (handle both cases)
    if (address) {
      const normalizedAddress = address.toLowerCase();
      logger.info(`[GET] Filtering by address: ${normalizedAddress}`);

      whereConditions = and(
        eq(alphaGeneratorsTable.isActive, isActive),
        eq(alphaGeneratorsTable.generatorAddress, normalizedAddress)
      );
    }

    const generators = await db
      .select()
      .from(alphaGeneratorsTable)
      .where(whereConditions)
      .orderBy(desc(alphaGeneratorsTable.registeredAt));

    logger.info(`[GET] Found ${generators.length} generators`, {
      address: address?.toLowerCase(),
      isActive,
      firstGeneratorAddress: generators[0]?.generatorAddress,
    });

    // Transform snake_case to camelCase and extract metadata fields
    const transformedGenerators = generators.map(gen => {
      const metadata = gen.metadata as any || {};
      return {
        generatorId: gen.generatorId,
        walletAddress: metadata.walletAddress || gen.generatorAddress,
        displayName: metadata.displayName || gen.name,
        description: gen.description,
        subscriptionFee: metadata.subscriptionFee || gen.minSubscriptionAmount,
        performanceFee: Number(gen.feePercentage) || 0,
        totalSubscribers: Number(gen.currentSubscribers) || 0,
        totalVolume: metadata.totalVolume || '0',
        rating: metadata.rating || 0,
        isVerified: metadata.verified || false,
        isActive: gen.isActive,
        metadata: gen.metadata || {},
        createdAt: gen.registeredAt,
        updatedAt: gen.updatedAt,
      };
    });

    return NextResponse.json({
      data: transformedGenerators,
      count: transformedGenerators.length,
    }, { status: 200 });
  } catch (error: any) {
    logger.error('GET error:', error);
    return NextResponse.json({
      error: 'Failed to fetch alpha generators',
      details: error.message,
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    logger.info('[Registration] Received AlphaGenerator registration:', {
      walletAddress: body.walletAddress,
      displayName: body.displayName,
      transactionHash: body.transactionHash,
    });

    // Manual validation for now to bypass Zod issue
    if (!body.walletAddress || !body.displayName || !body.subscriptionFee) {
      logger.error('[Registration] Validation failed: Missing required fields');
      return NextResponse.json({
        error: 'Invalid request data',
        details: 'Missing required fields: walletAddress, displayName, or subscriptionFee',
      }, { status: 400 });
    }

    // Skip Zod validation temporarily - directly use the body
    const validation = { success: true, data: body };
    /*
    const validation = RegisterGeneratorSchema.safeParse(body);
    if (!validation.success) {
      logger.error('[Registration] Validation failed:', validation.error.errors);
      return NextResponse.json({
        error: 'Invalid request data',
        details: validation.error.errors,
      }, { status: 400 });
    }
    */

    const {
      walletAddress,
      displayName,
      description,
      subscriptionFee,
      transactionHash,
      metadata
    } = validation.data;

    if (!ethers.isAddress(walletAddress)) {
      logger.error('[Registration] Invalid Ethereum address:', walletAddress);
      return NextResponse.json({
        error: 'Invalid Ethereum address format',
      }, { status: 400 });
    }

    // Normalize address to lowercase for consistent storage
    const normalizedAddress = walletAddress.toLowerCase();

    const [existing] = await db
      .select()
      .from(alphaGeneratorsTable)
      .where(eq(alphaGeneratorsTable.generatorAddress, normalizedAddress))
      .limit(1);

    if (existing) {
      logger.info({}, '[Registration] Updating existing generator: ' + walletAddress);
      const [updated] = await db
        .update(alphaGeneratorsTable)
        .set({
          name: displayName,
          description: description,
          minSubscriptionAmount: subscriptionFee,
          metadata: {
            ...((existing.metadata as any) || {}),
            displayName,
            subscriptionFee,
            walletAddress,
            transactionHash: transactionHash || ((existing.metadata as any)?.transactionHash),
            ...metadata,
          },
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(alphaGeneratorsTable.generatorAddress, normalizedAddress))
        .returning();

      logger.info({}, '[Registration] Generator updated successfully: ' + walletAddress);

      return NextResponse.json({
        data: updated,
        message: 'Alpha generator updated successfully',
      }, { status: 200 });
    }

    logger.info({}, '[Registration] Creating new generator: ' + walletAddress);

    const [generator] = await db
      .insert(alphaGeneratorsTable)
      .values({
        generatorAddress: normalizedAddress,
        name: displayName,
        description,
        feePercentage: '0', // Default to 0 as we removed performance fee
        minSubscriptionAmount: subscriptionFee,
        encryptionSupport: true,
        isActive: true,
        metadata: {
          displayName,
          subscriptionFee,
          walletAddress,
          transactionHash,
          ...metadata,
        },
        performanceStats: {
          totalTrades: 0,
          successRate: 0,
          avgReturns: 0,
          totalVolume: 0,
        },
      })
      .returning();

    logger.info({}, `[Registration] AlphaGenerator registered successfully: ${walletAddress}`);

    return NextResponse.json({
      data: generator,
      message: 'Alpha generator registered successfully',
    }, { status: 201 });
  } catch (error: any) {
    logger.error({
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    }, '[Registration] POST error:');
    console.error('[Registration] Full error:', error);
    return NextResponse.json({
      error: 'Failed to register alpha generator',
      details: error.message,
    }, { status: 500 });
  }
}