import { NextRequest } from 'next/server'
import { db } from '@/db/db'
import { subscriptions } from '@/db/schema/subscriptions-schema'
import { strategies } from '@/db/schema/strategies-schema'
import { sql, and, eq } from 'drizzle-orm'
import { successResponse, errorResponse, serverErrorResponse } from '@/app/api/api-utils'
import { ethers } from 'ethers'

export async function POST(req: NextRequest, { params }: { params: { id: string }}) {
  try {
    const strategyId = parseInt(params.id)

    // Validate strategyId is a number
    if (isNaN(strategyId)) {
      return errorResponse('Invalid strategy ID', 400, undefined, req)
    }

    const body = await req.json()
    const { subscriberWallet, subscriptionTxHash, subscriptionAmount } = body

    // Validate required fields
    if (!subscriberWallet || !subscriptionTxHash) {
      return errorResponse('subscriberWallet and subscriptionTxHash are required', 400, undefined, req)
    }

    // Validate wallet address format
    const walletRegex = /^0x[a-fA-F0-9]{40}$/
    if (!walletRegex.test(subscriberWallet)) {
      return errorResponse('Invalid wallet address format', 400, undefined, req)
    }

    // Check if strategy exists
    const [strategy] = await db.select().from(strategies).where(eq(strategies.strategyId, strategyId.toString())).limit(1)
    if (!strategy) {
      return errorResponse('Strategy not found', 404, undefined, req)
    }

    // Optional: Verify transaction on blockchain
    if (process.env.BLOCKCHAIN_RPC_URL) {
      try {
        const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL)
        const receipt = await provider.getTransactionReceipt(subscriptionTxHash)

        if (!receipt || receipt.status !== 1) {
          return errorResponse('Subscription transaction not found or failed', 400, undefined, req)
        }

        // Additional validation could be done here:
        // - Check if the transaction is to the correct contract
        // - Verify the amount paid matches the subscription fee
        // - Check if the sender is the subscriberWallet
      } catch (txError) {
        console.error('Error verifying transaction:', txError)
        // Continue without blockchain verification in development
        if (process.env.NODE_ENV === 'production') {
          return errorResponse('Failed to verify subscription transaction', 400, undefined, req)
        }
      }
    }

    // Normalize address to lowercase for consistent storage
    const normalizedSubscriberWallet = subscriberWallet.toLowerCase()

    // Check if already subscribed (check for active subscription)
    const [existing] = await db.select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.strategyId, strategyId.toString()),
          eq(subscriptions.alphaConsumerAddress, normalizedSubscriberWallet),
          eq(subscriptions.isActive, true)
        )
      )
      .limit(1)

    if (existing) {
      return successResponse(existing, 'Already subscribed to this strategy', 200, req)
    }

    // Create new subscription with normalized address
    const [newSubscription] = await db.insert(subscriptions).values({
      strategyId: strategyId.toString(),
      alphaConsumerAddress: normalizedSubscriberWallet,
      subscriptionTxHash: subscriptionTxHash,
      isActive: true
    }).returning()

    // Update subscriber count in strategies table
    // Note: In a production environment, this should be done in a transaction
    await db.execute(
      sql`UPDATE strategies
          SET subscriber_count = COALESCE(subscriber_count, 0) + 1,
              updated_at = NOW()
          WHERE strategy_id = ${strategyId.toString()}`
    )

    console.log(`[Subscribe] New subscription created: Strategy ${strategyId}, Wallet ${subscriberWallet}`)

    return successResponse(
      newSubscription,
      'Successfully subscribed to strategy',
      201,
      req
    )
  } catch (error: any) {
    console.error('[Subscribe] Error:', error)
    return serverErrorResponse(error, undefined, req)
  }
}

// GET endpoint to check subscription status
export async function GET(req: NextRequest, { params }: { params: { id: string }}) {
  try {
    const strategyId = parseInt(params.id)

    // Validate strategyId
    if (isNaN(strategyId)) {
      return errorResponse('Invalid strategy ID', 400, undefined, req)
    }

    // Get wallet address from query params
    const subscriberWallet = req.nextUrl.searchParams.get('wallet')

    if (!subscriberWallet) {
      return errorResponse('Wallet address is required', 400, undefined, req)
    }

    // Validate wallet address format
    const walletRegex = /^0x[a-fA-F0-9]{40}$/
    if (!walletRegex.test(subscriberWallet)) {
      return errorResponse('Invalid wallet address format', 400, undefined, req)
    }

    // Normalize address for consistent querying
    const normalizedWallet = subscriberWallet.toLowerCase()

    // Check subscription status
    const [subscription] = await db.select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.strategyId, strategyId.toString()),
          eq(subscriptions.alphaConsumerAddress, normalizedWallet)
        )
      )
      .limit(1)

    if (!subscription) {
      return successResponse(
        { isSubscribed: false },
        'Not subscribed to this strategy',
        200,
        req
      )
    }

    return successResponse(
      {
        isSubscribed: subscription.isActive,
        subscription
      },
      subscription.isActive ? 'Active subscription found' : 'Inactive subscription found',
      200,
      req
    )
  } catch (error: any) {
    console.error('[Subscribe GET] Error:', error)
    return serverErrorResponse(error, undefined, req)
  }
}

// OPTIONS - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Wallet-Address',
      'Access-Control-Max-Age': '86400',
    },
  })
}