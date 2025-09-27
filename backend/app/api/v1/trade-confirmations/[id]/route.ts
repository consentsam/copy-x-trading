/**
 * Trade Confirmation by ID API Route
 * Feature: 003-protocol-strategy-integration
 * Path: /api/v1/trade-confirmations/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getConfirmationService } from '@/src/services/confirmation-service';
import { getTradeExecutionService } from '@/src/services/trade-execution-service';

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
      'Access-Control-Allow-Methods': 'GET, PATCH, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Alpha-Consumer-Id',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// GET /api/v1/trade-confirmations/:id - Get trade confirmation by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = createPool();

  try {
    // Get AlphaConsumer ID from header
    const consumerId = request.headers.get('X-Alpha-Consumer-Id');

    if (!consumerId) {
      return NextResponse.json({
        success: false,
        error: 'AlphaConsumer ID required in X-Alpha-Consumer-Id header'
      }, {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const service = getConfirmationService(pool);

    // Get pending confirmations and find the specific one
    const result = await service.getPendingConfirmations({
      consumerId,
      limit: 1000 // Get all to find the specific one
    });

    const confirmation = result.confirmations.find(c => c.id === params.id);

    if (!confirmation) {
      return NextResponse.json({
        success: false,
        error: 'Confirmation not found or unauthorized'
      }, {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: confirmation
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error(`Error in GET /api/v1/trade-confirmations/${params.id}:`, error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch trade confirmation'
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

// PATCH /api/v1/trade-confirmations/:id - Accept or reject trade
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = createPool();

  try {
    // Get AlphaConsumer ID from header
    const consumerId = request.headers.get('X-Alpha-Consumer-Id');

    if (!consumerId) {
      return NextResponse.json({
        success: false,
        error: 'AlphaConsumer ID required in X-Alpha-Consumer-Id header'
      }, {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const body = await request.json();

    // Validate action
    if (!body.action || !['accept', 'reject'].includes(body.action)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Must be "accept" or "reject"'
      }, {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const service = getConfirmationService(pool);

    const updatedConfirmation = await service.updateConfirmation({
      confirmationId: params.id,
      action: body.action,
      modifiedParameters: body.modifiedParameters,
      consumerId
    });

    return NextResponse.json({
      success: true,
      data: updatedConfirmation
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error(`Error in PATCH /api/v1/trade-confirmations/${params.id}:`, error);

    // Handle specific errors
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, {
        status: 403,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (error.message?.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (error.message?.includes('Invalid') || error.message?.includes('expired')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update trade confirmation'
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

// POST /api/v1/trade-confirmations/:id/execute - Execute an accepted trade
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = createPool();

  try {
    // Get AlphaConsumer ID from header
    const consumerId = request.headers.get('X-Alpha-Consumer-Id');

    if (!consumerId) {
      return NextResponse.json({
        success: false,
        error: 'AlphaConsumer ID required in X-Alpha-Consumer-Id header'
      }, {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const body = await request.json();

    // Validate consumer address
    if (!body.consumerAddress) {
      return NextResponse.json({
        success: false,
        error: 'Consumer address is required'
      }, {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Check if simulation only
    if (body.simulate) {
      const executionService = getTradeExecutionService(pool);
      const simulation = await executionService.simulateTrade(
        params.id,
        body.consumerAddress
      );

      return NextResponse.json({
        success: true,
        data: {
          simulation: true,
          gasEstimate: simulation.gasEstimate,
          estimatedCost: simulation.estimatedCost,
          estimatedCostETH: (Number(simulation.estimatedCost) / 1e18).toFixed(6),
          parameters: simulation.parameters
        }
      }, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Execute the trade
    const executionService = getTradeExecutionService(pool);
    const result = await executionService.executeTrade({
      confirmationId: params.id,
      consumerAddress: body.consumerAddress,
      privateKey: body.privateKey // Optional, for automated execution
    });

    return NextResponse.json({
      success: true,
      data: result
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error(`Error in POST /api/v1/trade-confirmations/${params.id}/execute:`, error);

    // Handle specific errors
    if (error.message?.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (error.message?.includes('must be accepted')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to execute trade'
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