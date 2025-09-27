import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { alphaConsumersTable } from '@/db/schema/alpha-consumers-schema';
import { eq, desc } from 'drizzle-orm';
import { ethers } from 'ethers';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('[AlphaConsumer API] GET request received');

    const searchParams = req.nextUrl.searchParams;
    const address = searchParams.get('address');
    const isActive = searchParams.get('active') !== 'false';

    console.log('[AlphaConsumer API] Query params:', { address, isActive });

    // If address is provided, find specific consumer
    if (address) {
      const [consumer] = await db
        .select()
        .from(alphaConsumersTable)
        .where(eq(alphaConsumersTable.walletAddress, address.toLowerCase()))
        .limit(1);

      if (!consumer) {
        console.log('[AlphaConsumer API] Consumer not found:', address);
        return NextResponse.json({
          error: 'Alpha consumer not found',
        }, { status: 404 });
      }

      console.log('[AlphaConsumer API] Consumer found:', consumer);

      return NextResponse.json({
        data: consumer,
      }, { status: 200 });
    }

    // Otherwise return all consumers
    const consumers = await db
      .select()
      .from(alphaConsumersTable)
      .where(eq(alphaConsumersTable.isActive, isActive))
      .orderBy(desc(alphaConsumersTable.registeredAt));

    console.log('[AlphaConsumer API] Found consumers:', consumers.length);

    return NextResponse.json({
      data: consumers,
      count: consumers.length,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[AlphaConsumer API] GET error:', error);
    return NextResponse.json({
      error: 'Failed to fetch alpha consumers',
      details: error.message,
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('[AlphaConsumer API] POST request received');

    const body = await req.json();
    console.log('[AlphaConsumer API] Request body:', body);

    // Temporary fix: Manual validation to bypass Zod v4 compatibility issue
    const {
      walletAddress,
      displayName,
      experienceLevel,
      investmentBudget,
      bio,
      profileImage,
      preferences,
      metadata
    } = body;

    // Basic validation with type guards
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({
        error: 'Invalid request data: walletAddress is required and must be a string',
      }, { status: 400 });
    }

    if (!walletAddress.startsWith('0x')) {
      return NextResponse.json({
        error: 'Invalid request data: walletAddress must start with 0x',
      }, { status: 400 });
    }

    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json({
        error: 'Invalid request data: displayName is required and must be a string',
      }, { status: 400 });
    }

    const trimmedDisplayName = displayName.trim();

    if (trimmedDisplayName.length === 0 || trimmedDisplayName.length > 100) {
      return NextResponse.json({
        error: 'Invalid request data: displayName is required and must be 1-100 characters',
      }, { status: 400 });
    }

    console.log('[AlphaConsumer API] Validated data:', { walletAddress, displayName: trimmedDisplayName });

    if (!ethers.isAddress(walletAddress)) {
      console.error('[AlphaConsumer API] Invalid address format:', walletAddress);
      return NextResponse.json({
        error: 'Invalid Ethereum address format',
      }, { status: 400 });
    }

    // Check if consumer already exists
    const [existing] = await db
      .select()
      .from(alphaConsumersTable)
      .where(eq(alphaConsumersTable.walletAddress, walletAddress.toLowerCase()))
      .limit(1);

    if (existing) {
      console.log('[AlphaConsumer API] Consumer exists, updating:', walletAddress);

      // Update existing consumer
      const [updated] = await db
        .update(alphaConsumersTable)
        .set({
          displayName: trimmedDisplayName || existing.displayName,
          bio: bio || existing.bio,
          profileImage: profileImage || existing.profileImage,
          preferences: preferences || existing.preferences,
          metadata: {
            ...(existing.metadata ?? {}),
            ...(metadata || {}),
            experienceLevel,
            investmentBudget,
          },
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(alphaConsumersTable.walletAddress, walletAddress.toLowerCase()))
        .returning();

      console.log('[AlphaConsumer API] Consumer updated successfully:', updated);

      return NextResponse.json({
        data: updated,
        message: 'Alpha consumer updated successfully',
      }, { status: 200 });
    }

    // Create new consumer
    console.log('[AlphaConsumer API] Creating new consumer:', walletAddress);

    const insertResult = await db
      .insert(alphaConsumersTable)
      .values({
        walletAddress: walletAddress.toLowerCase(),
        displayName: trimmedDisplayName,
        bio: bio || '',
        profileImage,
        preferences: preferences || {
          notificationsEnabled: true,
          autoSubscribe: false,
        },
        stats: {
          totalSubscriptions: 0,
          activeSubscriptions: 0,
          totalInvested: 0,
          totalReturns: 0,
          avgROI: 0,
        },
        isActive: true,
        metadata: {
          ...(metadata || {}),
          experienceLevel,
          investmentBudget,
        },
      })
      .returning();

    const consumer = insertResult[0];
    console.log('[AlphaConsumer API] Consumer created successfully:', consumer);

    return NextResponse.json({
      data: consumer,
      message: 'Alpha consumer registered successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('[AlphaConsumer API] POST error:', error);
    return NextResponse.json({
      error: 'Failed to register alpha consumer',
      details: error.message,
    }, { status: 500 });
  }
}
