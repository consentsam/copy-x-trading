import { db } from '@/db/db';
import { tradeConfirmationsTable } from '@/db/schema/trade-confirmations-schema';
import { subscriptionsTable } from '@/db/schema/subscriptions-schema';
import { addressMappingsTable } from '@/db/schema/address-mappings-schema';
import { eq, lt, and, isNull, sql, gte } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { encryptionService } from './encryption.service';

export enum TradeStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export interface BroadcastTradeParams {
  generatorAddress: string;
  protocolId: string;
  action: string;
  executionData: string;
  expiryTime: Date;
  gasEstimate: bigint;
  metadata?: any;
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
    this.startExpiryMonitor();
    
    const AlphaEngineABI = [
      'event SubscriptionCreated(address indexed generator, bytes32 encryptedSubscriber, uint256 timestamp)',
      'event TradeProposed(bytes32 indexed tradeId, address indexed generator, uint256 expiryTime, uint256 gasEstimate)',
      'event TradeExecuted(bytes32 indexed tradeId, address indexed executor, bool success)',
      'event SubscriptionCancelled(address indexed generator, bytes32 encryptedSubscriber, uint256 timestamp)',
    ];
    
    this.contractInterface = new ethers.Interface(AlphaEngineABI);
    this.provider = new ethers.JsonRpcProvider(
      process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545'
    );
  }

  async broadcastTrade(params: BroadcastTradeParams): Promise<string[]> {
    const {
      generatorAddress,
      protocolId,
      action,
      executionData,
      expiryTime,
      gasEstimate,
      metadata
    } = params;

    // Normalize generator address for consistent storage
    const normalizedGeneratorAddress = generatorAddress.toLowerCase();

    const encryptedSubscribers = await this.getEncryptedSubscribers(normalizedGeneratorAddress);

    if (encryptedSubscribers.length === 0) {
      console.log(`[TradeLifecycle] No subscribers for generator ${normalizedGeneratorAddress}`);
      return [];
    }

    const confirmationIds: string[] = [];
    const createdTrades: any[] = [];

    for (const encryptedAddress of encryptedSubscribers) {
      const [confirmation] = await db
        .insert(tradeConfirmationsTable)
        .values({
          alphaGeneratorAddress: normalizedGeneratorAddress,
          alphaConsumerAddress: encryptedAddress,
          tradeId: ethers.id(`${normalizedGeneratorAddress}-${encryptedAddress}-${Date.now()}`),
          protocolId,
          action,
          executionData,
          expiryTime,
          gasEstimate: gasEstimate.toString(),
          status: TradeStatus.PENDING,
          metadata: metadata || {},
        })
        .returning();

      confirmationIds.push(confirmation.confirmationId);
      createdTrades.push(confirmation);
    }

    for (const trade of createdTrades) {
      const realAddress = await encryptionService.decryptAddress(
        trade.alphaConsumerAddress,
        normalizedGeneratorAddress
      );
      
      this.emit('tradeCreated', {
        ...trade,
        realConsumerAddress: realAddress,
      });
    }

    console.log(
      `[TradeLifecycle] Broadcasted trade to ${encryptedSubscribers.length} subscribers`
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
      if (additionalData.txHash) updateData.txHash = additionalData.txHash;
      if (additionalData.executedAt) updateData.executedAt = additionalData.executedAt;
      if (additionalData.gasUsed) updateData.gasUsed = additionalData.gasUsed.toString();
      if (additionalData.metadata) {
        updateData.metadata = sql`${tradeConfirmationsTable.metadata} || ${additionalData.metadata}::jsonb`;
      }
    }

    const [updated] = await db
      .update(tradeConfirmationsTable)
      .set(updateData)
      .where(eq(tradeConfirmationsTable.confirmationId, confirmationId))
      .returning();

    if (updated) {
      const realAddress = await encryptionService.decryptAddress(
        updated.alphaConsumerAddress,
        updated.alphaGeneratorAddress
      );
      
      this.emit('tradeStatusChanged', {
        ...updated,
        realConsumerAddress: realAddress,
        previousStatus: status === TradeStatus.EXECUTED ? TradeStatus.PENDING : status,
      });
    }
  }

  private startExpiryMonitor() {
    const checkInterval = 60000;
    
    this.expiryCheckInterval = setInterval(async () => {
      try {
        const now = new Date();
        
        const expiredTrades = await db
          .update(tradeConfirmationsTable)
          .set({ 
            status: TradeStatus.EXPIRED,
            metadata: sql`${tradeConfirmationsTable.metadata} || ${{ expiredAt: now.toISOString() }}::jsonb`
          })
          .where(
            and(
              eq(tradeConfirmationsTable.status, TradeStatus.PENDING),
              lt(tradeConfirmationsTable.expiryTime, now)
            )
          )
          .returning();

        for (const trade of expiredTrades) {
          const realAddress = await encryptionService.decryptAddress(
            trade.alphaConsumerAddress,
            trade.alphaGeneratorAddress
          );
          
          this.emit('tradeExpired', {
            ...trade,
            realConsumerAddress: realAddress,
          });
        }

        if (expiredTrades.length > 0) {
          console.log(`[TradeLifecycle] Expired ${expiredTrades.length} trades`);
        }
      } catch (error) {
        console.error('[TradeLifecycle] Expiry monitor error:', error);
      }
    }, checkInterval);
  }

  private async getEncryptedSubscribers(generatorAddress: string): Promise<string[]> {
    // Normalize address for consistent querying
    const normalizedGeneratorAddress = generatorAddress.toLowerCase();

    const subscriptions = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.alphaGeneratorAddress, normalizedGeneratorAddress),
          eq(subscriptionsTable.isActive, true)
        )
      );

    return subscriptions
      .map(sub => sub.encryptedConsumerAddress)
      .filter((addr): addr is string => addr !== null);
  }

  async sendExpiryWarnings(): Promise<void> {
    const warningThreshold = new Date(Date.now() + 5 * 60 * 1000);
    
    const expiringTrades = await db
      .select()
      .from(tradeConfirmationsTable)
      .where(
        and(
          eq(tradeConfirmationsTable.status, TradeStatus.PENDING),
          gte(tradeConfirmationsTable.expiryTime, new Date()),
          lt(tradeConfirmationsTable.expiryTime, warningThreshold)
        )
      );

    for (const trade of expiringTrades) {
      const realAddress = await encryptionService.decryptAddress(
        trade.alphaConsumerAddress,
        trade.alphaGeneratorAddress
      );
      
      this.emit('expiryWarning', {
        ...trade,
        realConsumerAddress: realAddress,
        timeRemaining: trade.expiryTime.getTime() - Date.now(),
      });
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
          
          const trades = await db
            .select()
            .from(tradeConfirmationsTable)
            .where(eq(tradeConfirmationsTable.tradeId, executedTradeId.toString()));
          
          for (const trade of trades) {
            await this.updateTradeStatus(
              trade.confirmationId,
              success ? TradeStatus.EXECUTED : TradeStatus.REJECTED,
              {
                txHash: log.transactionHash,
                executedAt: new Date(),
                gasUsed: BigInt(0),
                metadata: { executor, success },
              }
            );
          }
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
    // Normalize address for consistent querying
    const normalizedConsumerAddress = consumerAddress.toLowerCase();

    const mappings = await db
      .select()
      .from(addressMappingsTable)
      .where(eq(addressMappingsTable.realAddress, normalizedConsumerAddress));

    const encryptedAddresses = mappings.map(m => m.encryptedAddress);
    
    if (encryptedAddresses.length === 0) {
      return [];
    }

    let query = db
      .select()
      .from(tradeConfirmationsTable)
      .where(sql`${tradeConfirmationsTable.alphaConsumerAddress} = ANY(${encryptedAddresses})`);

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