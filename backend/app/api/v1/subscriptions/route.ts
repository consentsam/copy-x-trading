import { NextRequest } from 'next/server'
import { subscriptionManager } from '../../../../src/libraries/subscription-manager'
import { successResponse, errorResponse, serverErrorResponse } from '@/app/api/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const consumerAddress = req.nextUrl.searchParams.get('consumer')
    if (!consumerAddress) {
      return errorResponse('consumer parameter is required', 400, req)
    }

    // Normalize address to lowercase for consistent matching
    const normalizedAddress = consumerAddress.toLowerCase()

    // Use subscription manager to get active subscriptions
    const subscriptions = await subscriptionManager.getActiveSubscriptions(normalizedAddress)

    // Transform the data for frontend compatibility
    const transformedSubscriptions = subscriptions.map(sub => ({
      subscriptionId: sub.subscriptionId,
      alphaGeneratorAddress: sub.alphaGeneratorAddress,
      alphaConsumerAddress: sub.alphaConsumerAddress,
      subscriberAddress: sub.alphaConsumerAddress || '', // For UI compatibility
      encryptedConsumerAddress: sub.encryptedConsumerAddress || '',
      subscriptionType: sub.subscriptionType || 'generator',
      encryptionVersion: sub.encryptionVersion || 1,
      subscriptionTxHash: sub.subscriptionTxHash || '',
      subscribedAt: sub.subscribedAt.toISOString(),
      expiresAt: sub.expiresAt.toISOString(),
      isActive: sub.isActive,
      metadata: sub.metadata || {},
      subscriptionFee: sub.metadata?.feeAmount || '100000000000000000', // Default 0.1 ETH
      expiryDate: sub.expiresAt.toISOString(),
      strategyName: 'Strategy Subscription', // Default name
      createdAt: sub.createdAt ? sub.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: sub.updatedAt ? sub.updatedAt.toISOString() : new Date().toISOString(),
    }))

    // Calculate summary stats
    const activeCount = transformedSubscriptions.filter(s => s.isActive).length
    const totalFeesPaid = transformedSubscriptions.reduce((sum, sub) => {
      const fee = BigInt(sub.subscriptionFee || '0')
      return sum + fee
    }, 0n)

    return successResponse({
      subscriptions: transformedSubscriptions,
      stats: {
        activeSubscriptions: activeCount,
        totalSubscriptions: transformedSubscriptions.length,
        totalFeesPaid: totalFeesPaid.toString()
      }
    }, 'OK', 200, req)
  } catch (e: any) {
    return serverErrorResponse(e, req)
  }
}