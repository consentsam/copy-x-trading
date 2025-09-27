/**
 * Trade Confirmations API Route
 * Feature: 003-protocol-strategy-integration
 * Path: /api/v1/trade-confirmations
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getConfirmationService } from '@/src/services/confirmation-service';

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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Alpha-Consumer-Id',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// GET /api/v1/trade-confirmations - List pending trade confirmations
export async function GET(request: NextRequest) {
  const pool = createPool();

  try {
    // Get AlphaConsumer ID from header
    const consumerId = request.headers.get('X-Alpha-Consumer-Id');

    if (!consumerId) {
      return NextResponse.json({
        isSuccess: false,
        error: 'AlphaConsumer ID required in X-Alpha-Consumer-Id header'
      }, {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const service = getConfirmationService(pool);

    const result = await service.getPendingConfirmations({
      consumerId,
      status: searchParams.get('status') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    });

    return NextResponse.json({
      isSuccess: true,
      data: result.confirmations,
      total: result.total,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/v1/trade-confirmations:', error);

    return NextResponse.json({
      isSuccess: false,
      error: error.message || 'Failed to fetch trade confirmations'
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