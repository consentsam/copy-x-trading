/**
 * SSE Broadcast Service
 * Feature: 003-protocol-strategy-integration
 * Purpose: Server-Sent Events service for real-time trade broadcasting
 */

import { Pool } from 'pg';
import { getTradeBroadcastService } from '../lib/trade-broadcast';

export interface SSEClient {
  id: string;
  response: any;
  consumerId?: string;
  generatorId?: string;
}

export class SSEBroadcastService {
  private clients: Map<string, SSEClient> = new Map();
  private pool: Pool;
  private broadcastService: ReturnType<typeof getTradeBroadcastService>;

  constructor(pool: Pool) {
    this.pool = pool;
    this.broadcastService = getTradeBroadcastService(pool);

    // Start heartbeat to keep connections alive
    this.startHeartbeat();
  }

  /**
   * Register a new SSE client
   */
  registerClient(clientId: string, response: any, consumerId?: string, generatorId?: string): void {
    // Set SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no' // Disable Nginx buffering
    });

    // Store client
    this.clients.set(clientId, {
      id: clientId,
      response,
      consumerId,
      generatorId
    });

    // Register with broadcast service if consumer
    if (consumerId) {
      this.broadcastService.registerSSEClient(consumerId, response);
    }

    // Send initial connection event
    this.sendToClient(clientId, 'connected', {
      message: 'Connected to SSE stream',
      clientId,
      timestamp: new Date().toISOString()
    });

    console.log(`SSE client registered: ${clientId} (consumer: ${consumerId}, generator: ${generatorId})`);
  }

  /**
   * Unregister SSE client
   */
  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);

    if (client) {
      // Unregister from broadcast service if consumer
      if (client.consumerId) {
        this.broadcastService.unregisterSSEClient(client.consumerId);
      }

      // End response
      try {
        client.response.end();
      } catch (error) {
        // Response may already be closed
      }

      this.clients.delete(clientId);
      console.log(`SSE client unregistered: ${clientId}`);
    }
  }

  /**
   * Send event to specific client
   */
  sendToClient(clientId: string, event: string, data: any): boolean {
    const client = this.clients.get(clientId);

    if (!client) {
      return false;
    }

    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      client.response.write(message);
      return true;
    } catch (error) {
      // Client disconnected, remove them
      this.unregisterClient(clientId);
      return false;
    }
  }

  /**
   * Broadcast event to all consumers
   */
  broadcastToConsumers(event: string, data: any): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.consumerId) {
        if (this.sendToClient(clientId, event, data)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Broadcast event to all generators
   */
  broadcastToGenerators(event: string, data: any): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.generatorId) {
        if (this.sendToClient(clientId, event, data)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Send trade signal to specific consumer (alias for sendTradeBroadcast)
   */
  async sendTradeSignal(consumerId: string, tradeSignal: any): Promise<boolean> {
    return this.sendTradeBroadcast(consumerId, tradeSignal);
  }

  /**
   * Send trade broadcast to specific consumer
   */
  async sendTradeBroadcast(consumerId: string, tradeBroadcast: any): Promise<boolean> {
    // Find all clients for this consumer
    const consumerClients = Array.from(this.clients.entries())
      .filter(([_, client]) => client.consumerId === consumerId);

    if (consumerClients.length === 0) {
      return false;
    }

    let sent = false;

    for (const [clientId, _] of consumerClients) {
      if (this.sendToClient(clientId, 'trade-broadcast', tradeBroadcast)) {
        sent = true;
      }
    }

    return sent;
  }

  /**
   * Send trade confirmation update
   */
  async sendTradeConfirmation(consumerId: string, confirmation: any): Promise<boolean> {
    // Find all clients for this consumer
    const consumerClients = Array.from(this.clients.entries())
      .filter(([_, client]) => client.consumerId === consumerId);

    if (consumerClients.length === 0) {
      return false;
    }

    let sent = false;

    for (const [clientId, _] of consumerClients) {
      if (this.sendToClient(clientId, 'trade-confirmation', confirmation)) {
        sent = true;
      }
    }

    return sent;
  }

  /**
   * Send execution status to generator
   */
  async sendExecutionStatus(generatorId: string, status: any): Promise<boolean> {
    // Find all clients for this generator
    const generatorClients = Array.from(this.clients.entries())
      .filter(([_, client]) => client.generatorId === generatorId);

    if (generatorClients.length === 0) {
      return false;
    }

    let sent = false;

    for (const [clientId, _] of generatorClients) {
      if (this.sendToClient(clientId, 'execution-status', status)) {
        sent = true;
      }
    }

    return sent;
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    setInterval(() => {
      const timestamp = new Date().toISOString();
      const deadClients: string[] = [];

      for (const [clientId, client] of this.clients) {
        try {
          client.response.write(`:heartbeat ${timestamp}\n\n`);
        } catch (error) {
          // Client disconnected, mark for removal
          deadClients.push(clientId);
        }
      }

      // Remove dead clients
      for (const clientId of deadClients) {
        this.unregisterClient(clientId);
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Get connected client count
   */
  getClientCount(): { total: number; consumers: number; generators: number } {
    let consumers = 0;
    let generators = 0;

    for (const client of this.clients.values()) {
      if (client.consumerId) consumers++;
      if (client.generatorId) generators++;
    }

    return {
      total: this.clients.size,
      consumers,
      generators
    };
  }

  /**
   * Check if a consumer is connected
   */
  isConsumerConnected(consumerId: string): boolean {
    for (const client of this.clients.values()) {
      if (client.consumerId === consumerId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a generator is connected
   */
  isGeneratorConnected(generatorId: string): boolean {
    for (const client of this.clients.values()) {
      if (client.generatorId === generatorId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Send statistics update
   */
  async sendStatisticsUpdate(): Promise<void> {
    const stats = await this.broadcastService.getStatistics();
    const clientCount = this.getClientCount();

    const statsData = {
      ...stats,
      connectedClients: clientCount,
      timestamp: new Date().toISOString()
    };

    // Send to all connected clients
    for (const [clientId, _] of this.clients) {
      this.sendToClient(clientId, 'statistics', statsData);
    }
  }
}

// Export factory function - creates new instance per request
export function getSSEBroadcastService(pool: Pool): SSEBroadcastService {
  return new SSEBroadcastService(pool);
}