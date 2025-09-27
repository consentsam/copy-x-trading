import { NextRequest } from 'next/server'
import { db } from '@/db/db'
import { protocolTradeConfirmationsTable } from '@/db/schema/protocol-trade-confirmations-schema'
import { alphaConsumersTable } from '@/db/schema/alpha-consumers-schema'
import { eq, and } from 'drizzle-orm'
import { successResponse, errorResponse, serverErrorResponse } from '@/app/api/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const addr = req.nextUrl.searchParams.get('alphaConsumerAddress')
    if (!addr) {
      return errorResponse('alphaConsumerAddress is required', 400, req)
    }

    // First find the consumer by wallet address
    const consumers = await db
      .select()
      .from(alphaConsumersTable)
      .where(eq(alphaConsumersTable.walletAddress, addr));

    if (consumers.length === 0) {
      return successResponse([], 'No consumer found for address', 200, req)
    }

    const consumer = consumers[0];

    // Get pending trades for this consumer
    const data = await db
      .select()
      .from(protocolTradeConfirmationsTable)
      .where(
        and(
          eq(protocolTradeConfirmationsTable.alphaConsumerId, consumer.consumerId),
          eq(protocolTradeConfirmationsTable.status, 'PENDING')
        )
      );

    return successResponse(data, 'OK', 200, req)
  } catch (e: any) {
    return serverErrorResponse(e, req)
  }
}