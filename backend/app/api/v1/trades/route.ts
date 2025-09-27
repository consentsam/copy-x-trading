import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/db';
import { protocolTradeConfirmationsTable as tradeConfirmationsTable } from '@/db/schema/protocol-trade-confirmations-schema';
import { tradeBroadcastsTable } from '@/db/schema/trade-broadcasts-schema';
import { alphaGeneratorsTable } from '@/db/schema/alpha-generators-schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { ethers } from 'ethers';
import { z } from 'zod';
import { tradeLifecycleService, TradeStatus } from '@/lib/services/trade-lifecycle.service';
import { encryptionService } from '@/lib/services/encryption.service';

export const dynamic = 'force-dynamic';

const GetTradesSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  status: z.enum(['pending', 'executed', 'rejected', 'expired']).optional(),
  generatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    
    const params = {
      address: searchParams.get('address') || undefined,
      status: searchParams.get('status') as TradeStatus | undefined,
      generatorAddress: searchParams.get('generator') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };
    
    const validation = GetTradesSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: validation.error.errors,
      }, { status: 400 });
    }
    
    const { address, status, generatorAddress, limit, offset } = validation.data;
    
    let trades: any[] = [];
    
    if (address) {
      trades = await tradeLifecycleService.getTradesByConsumer(address, status);
    } else {
      // Build query with JOINs to get generator information
      let query = db
        .select({
          id: tradeConfirmationsTable.id,
          tradeBroadcastId: tradeConfirmationsTable.tradeBroadcastId,
          alphaConsumerId: tradeConfirmationsTable.alphaConsumerId,
          originalParameters: tradeConfirmationsTable.originalParameters,
          modifiedParameters: tradeConfirmationsTable.modifiedParameters,
          status: tradeConfirmationsTable.status,
          gasPrice: tradeConfirmationsTable.gasPrice,
          transactionHash: tradeConfirmationsTable.transactionHash,
          errorMessage: tradeConfirmationsTable.errorMessage,
          receivedAt: tradeConfirmationsTable.receivedAt,
          decidedAt: tradeConfirmationsTable.decidedAt,
          executedAt: tradeConfirmationsTable.executedAt,
          // Include broadcast and generator info
          strategyId: tradeBroadcastsTable.strategyId,
          alphaGeneratorId: tradeBroadcastsTable.alphaGeneratorId,
          generatorAddress: alphaGeneratorsTable.generatorAddress,
        })
        .from(tradeConfirmationsTable)
        .leftJoin(tradeBroadcastsTable, eq(tradeConfirmationsTable.tradeBroadcastId, tradeBroadcastsTable.id))
        .leftJoin(alphaGeneratorsTable, eq(tradeBroadcastsTable.alphaGeneratorId, alphaGeneratorsTable.generatorId))
        .orderBy(desc(tradeConfirmationsTable.receivedAt))
        .limit(limit)
        .offset(offset);

      const conditions: any[] = [];

      if (status) {
        conditions.push(eq(tradeConfirmationsTable.status, status));
      }

      if (generatorAddress) {
        conditions.push(eq(alphaGeneratorsTable.generatorAddress, generatorAddress));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      trades = await query;
    }
    
    const decryptedTrades = await Promise.all(
      trades.map(async (trade) => {
        // Note: Encryption not implemented yet, return trade as-is
        // TODO: Implement address encryption/decryption when consumer addresses are encrypted
        return {
          ...trade,
          realConsumerAddress: trade.alphaConsumerId, // Placeholder
          encryptedConsumerAddress: trade.alphaConsumerId, // Placeholder
        };
      })
    );
    
    return NextResponse.json({
      data: decryptedTrades,
      count: decryptedTrades.length,
      pagination: {
        limit,
        offset,
        hasMore: trades.length === limit,
      },
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Trades] GET error:', error);
    return NextResponse.json({
      error: 'Failed to fetch trades',
      details: error.message,
    }, { status: 500 });
  }
}