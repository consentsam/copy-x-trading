import { NextRequest, NextResponse } from 'next/server'
import { StrategyService } from '@/src/services/StrategyService'
import { ApiError } from '@/src/utils/errors'

const strategyService = new StrategyService()

// GET /api/v1/strategies/:id - Get strategy by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Strategy ID is required'
        },
        { status: 400 }
      )
    }

    const result = await strategyService.getStrategyById(id)
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error(`Error in GET /api/v1/strategies/${params.id}:`, error)

    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          details: error.details
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch strategy'
      },
      { status: 500 }
    )
  }
}

// PUT /api/v1/strategies/:id - Update strategy
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Strategy ID is required'
        },
        { status: 400 }
      )
    }

    // Get wallet address from header
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          message: 'Wallet address required in X-Wallet-Address header'
        },
        { status: 401 }
      )
    }

    // First, check if the strategy exists and belongs to the wallet
    const existingStrategy = await strategyService.getStrategyById(id)

    if (!existingStrategy.data) {
      return NextResponse.json(
        {
          success: false,
          message: 'Strategy not found'
        },
        { status: 404 }
      )
    }

    if (existingStrategy.data.walletAddress !== walletAddress) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized to modify this strategy'
        },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Don't allow changing wallet address
    if (body.walletAddress) {
      return NextResponse.json(
        {
          success: false,
          message: 'Cannot change strategy wallet address'
        },
        { status: 400 }
      )
    }

    const result = await strategyService.updateStrategy(id, body)
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error(`Error in PUT /api/v1/strategies/${params.id}:`, error)

    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          details: error.details
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update strategy'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/v1/strategies/:id - Deactivate strategy
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Strategy ID is required'
        },
        { status: 400 }
      )
    }

    // Get wallet address from header
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          message: 'Wallet address required in X-Wallet-Address header'
        },
        { status: 401 }
      )
    }

    // Validate wallet address format
    const walletRegex = /^0x[a-fA-F0-9]{40}$/
    if (!walletRegex.test(walletAddress)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid wallet address format'
        },
        { status: 400 }
      )
    }

    const result = await strategyService.deactivateStrategy(id, walletAddress)
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error(`Error in DELETE /api/v1/strategies/${params.id}:`, error)

    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          details: error.details
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to deactivate strategy'
      },
      { status: 500 }
    )
  }
}

// OPTIONS - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Wallet-Address',
      'Access-Control-Max-Age': '86400',
    },
  })
}