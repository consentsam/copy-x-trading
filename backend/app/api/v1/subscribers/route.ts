import { NextRequest } from 'next/server'
import { subscriptionManager } from '../../../../src/libraries/subscription-manager'
import { successResponse, errorResponse, serverErrorResponse } from '@/app/api/api-utils'

// Use Node.js runtime to support fs module for database SSL certificates
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Add OPTIONS handler for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204 })
}

export async function GET(req: NextRequest) {
  try {
    const generatorAddress = req.nextUrl.searchParams.get('generator')
    if (!generatorAddress) {
      return errorResponse('generator parameter is required', 400, req)
    }

    // Normalize address to lowercase for consistent matching
    const normalizedAddress = generatorAddress.toLowerCase()

    // Use subscription manager to get subscribers
    const subscribers = await subscriptionManager.getGeneratorSubscribers(normalizedAddress)

    // Transform the data for frontend compatibility
    const transformedSubscribers = subscribers.map(sub => ({
      subscriptionId: sub.subscriptionId,
      subscriberAddress: sub.alphaConsumerAddress,
      alphaConsumerAddress: sub.alphaConsumerAddress,
      alphaGeneratorAddress: sub.alphaGeneratorAddress,
      encryptedConsumerAddress: sub.encryptedConsumerAddress || '',
      subscriptionType: sub.subscriptionType || 'generator',
      subscriptionTxHash: sub.subscriptionTxHash || '',
      subscribedAt: sub.subscribedAt.toISOString(),
      expiresAt: sub.expiresAt.toISOString(),
      isActive: sub.isActive,
      metadata: sub.metadata || {},
      // Calculate fee from metadata (stored during subscription)
      subscriptionFee: sub.metadata?.feeAmount ?? '100000000000000000', // Default 0.1 ETH in wei
      expiryDate: sub.expiresAt.toISOString(),
      createdAt: sub.createdAt ? sub.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: sub.updatedAt ? sub.updatedAt.toISOString() : new Date().toISOString(),
    }))

    // Calculate summary stats
    const activeCount = transformedSubscribers.filter(s => s.isActive).length
    const totalRevenue = await subscriptionManager.calculateGeneratorRevenue(normalizedAddress)

    return successResponse({
      subscribers: transformedSubscribers,
      stats: {
        activeSubscribers: activeCount,
        totalSubscribers: transformedSubscribers.length,
        totalRevenue: totalRevenue
      }
    }, 'OK', 200, req)
  } catch (e: any) {
    return serverErrorResponse(e, req)
  }
}