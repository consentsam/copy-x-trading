import { NextRequest, NextResponse } from 'next/server'
import { StrategyService } from '@/src/services/StrategyService'
import { ApiError } from '@/src/utils/errors'

const strategyService = new StrategyService()

// GET /api/v1/strategies/:id/performance - Get strategy performance metrics
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id?.trim()

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid strategy ID'
        },
        { status: 400 }
      )
    }

    const result = await strategyService.getStrategyPerformance(id)
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error(`Error in GET /api/v1/strategies/${params.id}/performance:`, error)

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
        message: 'Failed to fetch performance metrics'
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
