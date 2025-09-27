/**
 * Strategy Execute API Route
 * Path: /api/v1/strategies/:id/execute
 * Unified endpoint for executing both regular and protocol strategies
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getProtocolStrategyService } from '@/src/services/strategy-service';
import { getTradeBroadcastService } from '@/src/lib/trade-broadcast';
import { getProtocolExecutor } from '@/src/lib/protocol-executor';

// Use Node.js runtime for database access
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Create database connection
function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL
  });
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Alpha-Generator-Id, X-Alpha-Generator-Address',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// POST /api/v1/strategies/:id/execute - Execute strategy and broadcast
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = createPool();

  try {
    // Get AlphaGenerator ID from header (now expects wallet address)
    const alphaGeneratorAddress = request.headers.get('X-Alpha-Generator-Address') ||
                                  request.headers.get('X-Alpha-Generator-Id'); // Support both for backward compatibility

    if (!alphaGeneratorAddress) {
      return NextResponse.json({
        isSuccess: false,
        message: 'AlphaGenerator address required in X-Alpha-Generator-Address or X-Alpha-Generator-Id header',
        timestamp: new Date().toISOString()
      }, {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.functions || !Array.isArray(body.functions)) {
      return NextResponse.json({
        isSuccess: false,
        message: 'Functions array is required',
        timestamp: new Date().toISOString()
      }, {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Get strategy details
    const strategyService = getProtocolStrategyService(pool);
    const strategy = await strategyService.getStrategy(params.id);

    if (!strategy) {
      return NextResponse.json({
        isSuccess: false,
        message: 'Strategy not found',
        timestamp: new Date().toISOString()
      }, {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Check authorization (compare wallet addresses)
    if (strategy.alphaGeneratorAddress.toLowerCase() !== alphaGeneratorAddress.toLowerCase()) {
      return NextResponse.json({
        isSuccess: false,
        message: 'Unauthorized to execute this strategy',
        timestamp: new Date().toISOString()
      }, {
        status: 403,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Check strategy is active
    if (!strategy.isActive) {
      return NextResponse.json({
        isSuccess: false,
        message: 'Strategy is not active',
        timestamp: new Date().toISOString()
      }, {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Initialize services
    const broadcastService = getTradeBroadcastService(pool);
    const executor = getProtocolExecutor(pool);

    // Process each function in the strategy
    const broadcasts = [];
    const estimations = [];

    for (const func of body.functions) {
      if (!func.functionName || !func.parameters) {
        return NextResponse.json({
          isSuccess: false,
          message: 'Each function must have functionName and parameters',
          timestamp: new Date().toISOString()
        }, {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Validate function is part of the strategy
      const strategyFunc = strategy.functions?.find(
        (sf: any) => sf.functionName === func.functionName
      );

      if (!strategyFunc) {
        return NextResponse.json({
          isSuccess: false,
          message: `Function ${func.functionName} is not part of this strategy`,
          timestamp: new Date().toISOString()
        }, {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Estimate gas for the function
      const gasEstimation = await executor.estimateGas({
        functionName: func.functionName,
        protocol: strategy.protocol,
        parameters: func.parameters,
        contractAddress: '', // Will be resolved by executor
        network: body.network || 'localhost',
        userAddress: body.userAddress || alphaGeneratorAddress
      });

      estimations.push(gasEstimation);

      // Broadcast the trade to subscribers
      // Note: alphaGeneratorId is now a wallet address, but trade_broadcasts expects UUID
      // Pass null since it's optional and we have strategy_id for reference
      const broadcastResponse = await broadcastService.broadcast({
        strategyId: params.id,
        alphaGeneratorId: null, // Using null since we have wallet addresses now, not UUIDs
        functionName: func.functionName,
        protocol: strategy.protocol,
        parameters: func.parameters,
        gasEstimate: gasEstimation.gasLimit,
        network: body.network || 'localhost',
        expiryMinutes: body.expiryMinutes || 5
      });

      broadcasts.push({
        functionName: func.functionName,
        broadcastId: broadcastResponse.broadcastId,
        correlationId: broadcastResponse.correlationId,
        recipientCount: broadcastResponse.recipientCount,
        expiresAt: broadcastResponse.expiresAt
      });
    }

    // Calculate total estimated cost
    const totalEstimatedCost = estimations.reduce(
      (sum, est) => sum + BigInt(est.totalCost),
      BigInt(0)
    );

    return NextResponse.json({
      isSuccess: true,
      message: 'Strategy executed and broadcast successfully',
      data: {
        strategyId: params.id,
        strategyName: strategy.strategyName,
        broadcasts,
        totalEstimatedGas: totalEstimatedCost.toString(),
        estimatedCostETH: (Number(totalEstimatedCost) / 1e18).toFixed(6)
      },
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error(`Error in POST /api/v1/strategies/${params.id}/execute:`, error);

    return NextResponse.json({
      isSuccess: false,
      message: error.message || 'Failed to execute strategy',
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  } finally {
    await pool.end();
  }
}