/**
 * SSE Trade Stream API Route
 * Feature: 003-protocol-strategy-integration
 * Path: /api/v1/sse/trades
 */

import { NextRequest } from 'next/server';
import { Pool } from 'pg';
import { getSSEBroadcastService } from '@/src/services/sse-broadcast-service';
import { v4 as uuidv4 } from 'uuid';

// Use Node.js runtime for SSE streaming
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Create database connection
function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL
  });
}

// GET /api/v1/sse/trades - SSE stream for trade broadcasts
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const consumerId = searchParams.get('consumerId');
  const generatorId = searchParams.get('generatorId');

  if (!consumerId && !generatorId) {
    return new Response('Either consumerId or generatorId is required', {
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const pool = createPool();
  const sseService = getSSEBroadcastService(pool);
  const clientId = uuidv4();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Custom response object that works with our SSE service
      const response = {
        write: (data: string) => {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            console.error('Error writing to SSE stream:', error);
          }
        },
        writeHead: () => {}, // Not needed for ReadableStream
        end: () => {
          try {
            controller.close();
          } catch (error) {
            // Stream may already be closed
          }
        }
      };

      // Register the client
      sseService.registerClient(clientId, response, consumerId || undefined, generatorId || undefined);

      // Send initial pending trades if consumer
      if (consumerId) {
        try {
          const broadcastService = await import('@/src/lib/trade-broadcast');
          const service = broadcastService.getTradeBroadcastService(pool);
          const pendingTrades = await service.getPendingTrades(consumerId);

          if (pendingTrades.length > 0) {
            const message = `event: pending-trades\ndata: ${JSON.stringify({
              count: pendingTrades.length,
              trades: pendingTrades
            })}\n\n`;
            response.write(message);
          }
        } catch (error) {
          console.error('Error fetching pending trades:', error);
        }
      }

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        sseService.unregisterClient(clientId);
        pool.end();
      });
    },

    cancel() {
      // Cleanup when stream is cancelled
      sseService.unregisterClient(clientId);
      pool.end();
    }
  });

  // Return SSE response with appropriate headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    }
  });
}