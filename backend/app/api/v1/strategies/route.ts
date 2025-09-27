import { NextRequest, NextResponse } from 'next/server'
import { StrategyService } from '@/src/services/StrategyService'
import { withAuth, withRateLimit } from '@/src/middleware/errorMiddleware'
import { ApiError } from '@/src/utils/errors'

// Use Node.js runtime to support fs module for database SSL certificates
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const strategyService = new StrategyService()

// OPTIONS handler for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}

// GET /api/v1/strategies - List all strategies
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const isActive = searchParams.get('isActive') === 'true' ? true :
                     searchParams.get('isActive') === 'false' ? false : undefined
    const walletAddress = searchParams.get('walletAddress') || undefined
    const protocol = searchParams.get('protocol') || undefined  // Added protocol filter
    // Normalize address for consistent querying
    const normalizedWalletAddress = walletAddress?.toLowerCase()

    const result = await strategyService.getStrategies({
      page,
      limit,
      isActive,
      walletAddress: normalizedWalletAddress,
      protocol  // Pass protocol filter to service
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('Error in GET /api/v1/strategies:', error)

    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          isSuccess: false,
          message: error.message,
          details: error.details
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      {
        isSuccess: false,
        message: 'Failed to fetch strategies'
      },
      { status: 500 }
    )
  }
}

// POST /api/v1/strategies - Create new strategy
export async function POST(request: NextRequest) {
  try {
    // Get wallet address from header
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        {
          isSuccess: false,
          message: 'Wallet address required in X-Wallet-Address header'
        },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Wallet-Address',
          }
        }
      )
    }

    // Validate wallet address format
    const walletRegex = /^0x[a-fA-F0-9]{40}$/
    if (!walletRegex.test(walletAddress)) {
      return NextResponse.json(
        {
          isSuccess: false,
          message: 'Invalid wallet address format'
        },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate required fields
    if (!body.strategyName) {
      return NextResponse.json(
        {
          isSuccess: false,
          message: 'Strategy name is required'
        },
        { status: 400 }
      )
    }

    // Normalize addresses to lowercase for consistent storage
    const normalizedWalletAddress = walletAddress.toLowerCase()
    const normalizedGeneratorAddress = body.alphaGeneratorAddress?.toLowerCase()

    const result = await strategyService.createStrategy({
      walletAddress: normalizedWalletAddress,
      strategyName: body.strategyName,
      strategyDescription: body.strategyDescription,
      strategyJSON: body.strategyJSON,
      supportedProtocols: body.supportedProtocols,
      alphaGeneratorAddress: normalizedGeneratorAddress || normalizedWalletAddress
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/v1/strategies:', error)

    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          isSuccess: false,
          message: error.message,
          details: error.details
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      {
        isSuccess: false,
        message: 'Failed to create strategy'
      },
      { status: 500 }
    )
  }
}

