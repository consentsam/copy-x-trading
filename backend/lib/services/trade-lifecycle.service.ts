import { db } from '@/db/db';
import { protocolTradeConfirmationsTable as tradeConfirmationsTable } from '@/db/schema/protocol-trade-confirmations-schema';
import { tradeBroadcastsTable } from '@/db/schema/trade-broadcasts-schema';
import { subscriptionsTable } from '@/db/schema/subscriptions-schema';
import { addressMappingsTable } from '@/db/schema/address-mappings-schema';
import { alphaGeneratorsTable } from '@/db/schema/alpha-generators-schema';
import { alphaConsumersTable } from '@/db/schema/alpha-consumers-schema';
import { eq, lt, and, isNull, sql, gte } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { encryptionService } from '@/lib/services/encryption.service';
import { v4 as uuidv4 } from 'uuid';

export enum TradeStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXECUTING = 'EXECUTING',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  EXPIRED = 'FAILED', // Map EXPIRED to FAILED since DB doesn't have EXPIRED
}

export interface BroadcastTradeParams {
  generatorAddress: string;
  protocolId?: string;
  action?: string;
  executionData?: string;
  expiryTime: Date;
  gasEstimate: string;
  metadata?: any;
  // New fields to match schema
  strategyId?: string;
  functionName?: string;
  functionABI?: any;
  parameters?: any;
  contractAddress?: string;
}

export interface TradeUpdateData {
  txHash?: string;
  executedAt?: Date;
  gasUsed?: bigint;
  error?: string;
  metadata?: any;
}

export class TradeLifecycleService extends EventEmitter {
  private expiryCheckInterval: NodeJS.Timeout | null = null;
  private contractInterface: ethers.Interface;
  private provider: ethers.Provider;

  constructor() {
    super();

    // Validate required environment variables
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    if (!rpcUrl) {
      throw new Error(
        '[TradeLifecycle] BLOCKCHAIN_RPC_URL environment variable is required. ' +
        'Please set it to your blockchain RPC endpoint (e.g., https://rpc.fhenix.zone for mainnet, ' +
        'http://localhost:8545 for local development).'
      );
    }

    // Log the RPC URL being used (masked for security)
    console.log(
      `[TradeLifecycle] Initializing with RPC URL: ${rpcUrl.includes('localhost') ? rpcUrl : rpcUrl.replace(/\/\/([^:]+):([^@]+)@/, '//*****:*****@')}`
    );

    this.startExpiryMonitor();

    const AlphaEngineABI = [
      'event SubscriptionCreated(address indexed generator, bytes32 encryptedSubscriber, uint256 timestamp)',
      'event TradeProposed(bytes32 indexed tradeId, address indexed generator, uint256 expiryTime, uint256 gasEstimate)',
      'event TradeExecuted(bytes32 indexed tradeId, address indexed executor, bool success)',
      'event SubscriptionCancelled(address indexed generator, bytes32 encryptedSubscriber, uint256 timestamp)',
    ];

    this.contractInterface = new ethers.Interface(AlphaEngineABI);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async broadcastTrade(params: BroadcastTradeParams): Promise<string[]> {
    const {
      generatorAddress,
      protocolId,
      action,
      executionData,
      expiryTime,
      gasEstimate,
      metadata,
      strategyId,
      functionName,
      functionABI,
      parameters,
      contractAddress
    } = params;

    const subscribers = await this.getEncryptedSubscribers(generatorAddress);

    if (subscribers.length === 0) {
      console.log(`[TradeLifecycle] No subscribers for generator ${generatorAddress}`);
      return [];
    }

    // Get the generator record
    const [generator] = await db
      .select()
      .from(alphaGeneratorsTable)
      .where(eq(alphaGeneratorsTable.generatorAddress, generatorAddress))
      .limit(1);

    if (!generator) {
      throw new Error(`Generator not found: ${generatorAddress}`);
    }

    // Step 1: Create the trade broadcast record
    const correlationId = uuidv4();
    const [broadcast] = await db
      .insert(tradeBroadcastsTable)
      .values({
        strategyId: strategyId || `strategy-${Date.now()}`,
        alphaGeneratorId: generator.generatorId,
        functionName: functionName || 'unknown',
        protocol: protocolId || 'unknown',
        parameters: parameters || {},
        contractAddress: contractAddress || '0x0000000000000000000000000000000000000000',
        gasEstimate: gasEstimate,
        network: 'anvil', // TODO: make this configurable
        correlationId,
        expiresAt: expiryTime,
      })
      .returning();

    console.log(`[TradeLifecycle] Created broadcast ${broadcast.id} for strategy ${strategyId}`);

    // Step 2: Create confirmation records for each subscriber
    const confirmationIds: string[] = [];
    const createdTrades: any[] = [];

    for (const subscriber of subscribers) {
      // Get or create the consumer record using the real address
      let consumer;
      const realAddress = subscriber.realAddress;

      // Check if consumer exists using the real wallet address
      const existingConsumers = await db
        .select()
        .from(alphaConsumersTable)
        .where(eq(alphaConsumersTable.walletAddress, realAddress));

      if (existingConsumers.length === 0) {
        // Create consumer if doesn't exist
        const [newConsumer] = await db
          .insert(alphaConsumersTable)
          .values({
            walletAddress: realAddress,
            displayName: `Consumer ${realAddress.substring(0, 10)}`,
            isActive: true,
          })
          .returning();
        consumer = newConsumer;
      } else {
        consumer = existingConsumers[0];
      }

      const [confirmation] = await db
        .insert(tradeConfirmationsTable)
        .values({
          tradeBroadcastId: broadcast.id,
          alphaConsumerId: consumer.consumerId,
          originalParameters: parameters || {},
          modifiedParameters: parameters || {},
          status: TradeStatus.PENDING,
        })
        .returning();

      confirmationIds.push(confirmation.id);
      createdTrades.push(confirmation);
    }

    // Emit events for created trades
    for (const trade of createdTrades) {
      this.emit('tradeCreated', {
        ...trade,
        broadcast,
        generatorAddress,
      });
    }

    console.log(
      `[TradeLifecycle] Broadcasted trade to ${subscribers.length} subscribers`
    );

    return confirmationIds;
  }

  async updateTradeStatus(
    confirmationId: string,
    status: TradeStatus,
    additionalData?: TradeUpdateData
  ): Promise<void> {
    const updateData: any = { status };

    if (additionalData) {
      if (additionalData.txHash) updateData.transactionHash = additionalData.txHash;
      if (additionalData.executedAt) updateData.executedAt = additionalData.executedAt;
      if (status === TradeStatus.EXECUTED) {
        updateData.decidedAt = new Date();
      }
      if (additionalData.error) {
        updateData.errorMessage = additionalData.error;
      }
      if (additionalData.gasUsed) {
        updateData.gasPrice = additionalData.gasUsed.toString();
      }
    }

    const [updated] = await db
      .update(tradeConfirmationsTable)
      .set(updateData)
      .where(eq(tradeConfirmationsTable.id, confirmationId))
      .returning();

    if (updated) {
      this.emit('tradeStatusChanged', {
        ...updated,
        previousStatus: status === TradeStatus.EXECUTED ? TradeStatus.PENDING : status,
      });
    }
  }

  private startExpiryMonitor() {
    const checkInterval = 60000;

    this.expiryCheckInterval = setInterval(async () => {
      try {
        const now = new Date();

        // First, find expired broadcasts
        const expiredBroadcasts = await db
          .select()
          .from(tradeBroadcastsTable)
          .where(
            lt(tradeBroadcastsTable.expiresAt, now)
          );

        for (const broadcast of expiredBroadcasts) {
          // Update all related confirmations to failed (expired)
          const expiredConfirmations = await db
            .update(tradeConfirmationsTable)
            .set({
              status: TradeStatus.FAILED,
            })
            .where(
              and(
                eq(tradeConfirmationsTable.tradeBroadcastId, broadcast.id),
                eq(tradeConfirmationsTable.status, TradeStatus.PENDING)
              )
            )
            .returning();

          for (const confirmation of expiredConfirmations) {
            this.emit('tradeExpired', {
              ...confirmation,
              broadcast,
            });
          }

          if (expiredConfirmations.length > 0) {
            console.log(`[TradeLifecycle] Expired ${expiredConfirmations.length} trades for broadcast ${broadcast.id}`);
          }
        }
      } catch (error) {
        console.error('[TradeLifecycle] Expiry monitor error:', error);
      }
    }, checkInterval);
  }

  private async getEncryptedSubscribers(generatorAddress: string): Promise<{ encryptedAddress: string; realAddress: string }[]> {
    const subscriptions = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.alphaGeneratorAddress, generatorAddress),
          eq(subscriptionsTable.isActive, true)
        )
      );

    return subscriptions
      .map(sub => ({
        encryptedAddress: sub.encryptedConsumerAddress || '',
        realAddress: sub.alphaConsumerAddress || ''
      }))
      .filter(sub => sub.realAddress !== '');
  }

  async sendExpiryWarnings(): Promise<void> {
    const warningThreshold = new Date(Date.now() + 5 * 60 * 1000);
    const now = new Date();

    // Find broadcasts that are about to expire
    const expiringBroadcasts = await db
      .select()
      .from(tradeBroadcastsTable)
      .where(
        and(
          gte(tradeBroadcastsTable.expiresAt, now),
          lt(tradeBroadcastsTable.expiresAt, warningThreshold)
        )
      );

    for (const broadcast of expiringBroadcasts) {
      // Find related pending confirmations
      const pendingConfirmations = await db
        .select()
        .from(tradeConfirmationsTable)
        .where(
          and(
            eq(tradeConfirmationsTable.tradeBroadcastId, broadcast.id),
            eq(tradeConfirmationsTable.status, TradeStatus.PENDING)
          )
        );

      for (const confirmation of pendingConfirmations) {
        this.emit('expiryWarning', {
          ...confirmation,
          broadcast,
          timeRemaining: broadcast.expiresAt.getTime() - Date.now(),
        });
      }
    }
  }

  async parseContractEvent(log: ethers.Log): Promise<void> {
    try {
      const parsedLog = this.contractInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (!parsedLog) return;

      switch (parsedLog.name) {
        case 'SubscriptionCreated':
          const { generator, encryptedSubscriber, timestamp } = parsedLog.args;
          this.emit('subscriptionUpdate', {
            type: 'created',
            generator,
            encryptedSubscriber: encryptedSubscriber.toString(),
            timestamp: new Date(Number(timestamp) * 1000),
          });
          break;
          
        case 'TradeProposed':
          const { tradeId, generator: tradeGenerator, expiryTime, gasEstimate } = parsedLog.args;
          console.log('[TradeLifecycle] Trade proposed:', {
            tradeId: tradeId.toString(),
            generator: tradeGenerator,
            expiryTime: new Date(Number(expiryTime) * 1000),
            gasEstimate: gasEstimate.toString(),
          });
          break;
          
        case 'TradeExecuted':
          const { tradeId: executedTradeId, executor, success } = parsedLog.args;
          
          // Note: protocol_trade_confirmations doesn't have a tradeId field
          // We'd need to link through trade_broadcasts if we had a trade ID
          // For now, log the event
          console.log('[TradeLifecycle] Trade executed on-chain:', {
            tradeId: executedTradeId.toString(),
            executor,
            success,
            txHash: log.transactionHash,
          });
          break;
          
        case 'SubscriptionCancelled':
          const { generator: cancelGenerator, encryptedSubscriber: cancelledSubscriber } = parsedLog.args;
          this.emit('subscriptionUpdate', {
            type: 'cancelled',
            generator: cancelGenerator,
            encryptedSubscriber: cancelledSubscriber.toString(),
            timestamp: new Date(),
          });
          break;
      }
    } catch (error) {
      console.error('[TradeLifecycle] Error parsing contract event:', error);
    }
  }

  async getTradesByConsumer(
    consumerAddress: string,
    status?: TradeStatus
  ): Promise<any[]> {
    // First find the consumer by their wallet address
    const consumers = await db
      .select()
      .from(alphaConsumersTable)
      .where(eq(alphaConsumersTable.walletAddress, consumerAddress));

    if (consumers.length === 0) {
      return [];
    }

    const consumer = consumers[0];

    // Now find confirmations for this consumer
    let query = db
      .select()
      .from(tradeConfirmationsTable)
      .where(eq(tradeConfirmationsTable.alphaConsumerId, consumer.consumerId));

    if (status) {
      query = query.where(eq(tradeConfirmationsTable.status, status));
    }

    const trades = await query;

    return trades.map(trade => ({
      ...trade,
      realConsumerAddress: consumerAddress,
    }));
  }

  cleanup(): void {
    if (this.expiryCheckInterval) {
      clearInterval(this.expiryCheckInterval);
      this.expiryCheckInterval = null;
    }
    this.removeAllListeners();
  }
}

export const tradeLifecycleService = new TradeLifecycleService();