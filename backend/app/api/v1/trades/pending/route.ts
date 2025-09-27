import { NextRequest } from 'next/server'
import { db } from '@/db/db'
import { protocolTradeConfirmationsTable } from '@/db/schema/protocol-trade-confirmations-schema'
import { tradeBroadcastsTable } from '@/db/schema/trade-broadcasts-schema'
import { alphaConsumersTable } from '@/db/schema/alpha-consumers-schema'
import { alphaGeneratorsTable } from '@/db/schema/alpha-generators-schema'
import { eq, and } from 'drizzle-orm'
import { successResponse, errorResponse, serverErrorResponse } from '@/app/api/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address')
    if (!address) {
      return errorResponse('address parameter is required', 400, req)
    }

    // First find the consumer by wallet address
    const consumers = await db
      .select()
      .from(alphaConsumersTable)
      .where(eq(alphaConsumersTable.walletAddress, address));

    if (consumers.length === 0) {
      return successResponse([], 'No consumer found for address', 200, req)
    }

    const consumer = consumers[0];

    // Get pending trades with JOINs to get full information
    const data = await db
      .select({
        id: protocolTradeConfirmationsTable.id,
        tradeBroadcastId: protocolTradeConfirmationsTable.tradeBroadcastId,
        originalParameters: protocolTradeConfirmationsTable.originalParameters,
        modifiedParameters: protocolTradeConfirmationsTable.modifiedParameters,
        status: protocolTradeConfirmationsTable.status,
        gasPrice: protocolTradeConfirmationsTable.gasPrice,
        receivedAt: protocolTradeConfirmationsTable.receivedAt,
        // Broadcast info
        strategyId: tradeBroadcastsTable.strategyId,
        protocol: tradeBroadcastsTable.protocol,
        functionName: tradeBroadcastsTable.functionName,
        gasEstimate: tradeBroadcastsTable.gasEstimate,
        expiresAt: tradeBroadcastsTable.expiresAt,
        // Generator info
        generatorAddress: alphaGeneratorsTable.generatorAddress,
      })
      .from(protocolTradeConfirmationsTable)
      .leftJoin(tradeBroadcastsTable, eq(protocolTradeConfirmationsTable.tradeBroadcastId, tradeBroadcastsTable.id))
      .leftJoin(alphaGeneratorsTable, eq(tradeBroadcastsTable.alphaGeneratorId, alphaGeneratorsTable.generatorId))
      .where(
        and(
          eq(protocolTradeConfirmationsTable.alphaConsumerId, consumer.consumerId),
          eq(protocolTradeConfirmationsTable.status, 'PENDING')
        )
      );

    // Map the data to match the TradeNotification interface expected by frontend
    const pendingTrades = data.map(trade => {
      const originalParams = trade.originalParameters as any || {};

      return {
        confirmationId: trade.id,
        alphaGeneratorAddress: trade.generatorAddress || '',
        alphaConsumerAddress: address,
        executionParams: {
          protocol: trade.protocol || '',
          action: trade.functionName || '',
          tokenIn: originalParams.tokenIn || undefined,
          tokenOut: originalParams.tokenOut || undefined,
          amount: originalParams.amount || originalParams.amountIn || '0',
          slippage: originalParams.slippage || undefined,
          data: originalParams,
        },
        gasEstimate: trade.gasEstimate || '0',
        tradeStatus: 'pending' as const,
        expiryTimestamp: trade.expiresAt?.toISOString() || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        protocolMetadata: {
          displayName: trade.protocol || 'Unknown Protocol',
          icon: undefined,
          requiresApproval: false,
          description: `${trade.functionName} on ${trade.protocol}`,
        },
      };
    });

    return successResponse(pendingTrades, 'OK', 200, req)
  } catch (e: any) {
    return serverErrorResponse(e, req)
  }
}