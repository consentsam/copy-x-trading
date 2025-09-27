import { apiClient } from './api-client';

// AlphaEngine specific types
export interface AlphaGenerator {
  generatorId: string;
  walletAddress: string;
  displayName?: string;
  description?: string;
  subscriptionFee: string;
  performanceFee: number;
  totalSubscribers: number;
  totalVolume: string;
  rating: number;
  isVerified: boolean;
  isActive: boolean;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

export interface AlphaSubscription {
  subscriptionId: string;
  alphaGeneratorAddress: string;
  alphaConsumerAddress: string;
  encryptedConsumerAddress?: string;
  subscriptionType: 'generator' | 'strategy';
  encryptionVersion: number;
  subscriptionTxHash?: string;
  isActive: boolean;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

export interface TradeNotification {
  confirmationId: string;
  alphaGeneratorAddress: string;
  alphaConsumerAddress: string;
  executionParams: {
    protocol: string;
    action: string;
    tokenIn?: string;
    tokenOut?: string;
    amount: string;
    slippage?: number;
    data?: Record<string, string | number | boolean | null>;
  };
  gasEstimate: string;
  tradeStatus: 'pending' | 'executed' | 'rejected' | 'expired';
  expiryTimestamp: string;
  protocolMetadata?: {
    displayName?: string;
    icon?: string;
    requiresApproval?: boolean;
    description?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

class AlphaEngineClient {
  /**
   * Fetch all active alpha generators
   */
  async getGenerators(active: boolean = true): Promise<AlphaGenerator[]> {
    return apiClient.get<AlphaGenerator[]>(
      `/api/v1/alpha-generators?active=${active}`
    );
  }

  /**
   * Get a specific generator by address
   */
  async getGenerator(address: string): Promise<AlphaGenerator> {
    return apiClient.get<AlphaGenerator>(
      `/api/v1/alpha-generators/${address}`
    );
  }

  /**
   * Register a new alpha generator
   */
  async registerGenerator(params: {
    walletAddress: string;
    displayName?: string;
    description?: string;
    subscriptionFee: string;
    performanceFee?: number;
  }): Promise<AlphaGenerator> {
    return apiClient.post<AlphaGenerator>(
      '/api/v1/alpha-generators',
      params
    );
  }

  /**
   * Subscribe to an alpha generator
   */
  async subscribeToGenerator(
    generatorAddress: string,
    subscriberWallet: string,
    subscriptionTxHash: string
  ): Promise<AlphaSubscription> {
    return apiClient.post<AlphaSubscription>(
      `/api/v1/alpha-generators/${generatorAddress}/subscribe`,
      {
        subscriberWallet,
        subscriptionTxHash,
      }
    );
  }

  /**
   * Get subscriptions for a generator
   */
  async getGeneratorSubscriptions(
    generatorAddress: string
  ): Promise<AlphaSubscription[]> {
    return apiClient.get<AlphaSubscription[]>(
      `/api/v1/alpha-generators/${generatorAddress}/subscribe`
    );
  }

  /**
   * Verify subscription status
   */
  async verifySubscription(
    consumerAddress: string,
    generatorAddress: string
  ): Promise<{ isSubscribed: boolean; subscription?: Partial<AlphaSubscription> }> {
    return apiClient.post<{ isSubscribed: boolean; subscription?: Partial<AlphaSubscription> }>(
      '/api/v1/alpha-generators/verify',
      {
        consumerAddress,
        generatorAddress,
      }
    );
  }

  /**
   * Get user's subscriptions
   */
  async getUserSubscriptions(
    userAddress: string
  ): Promise<AlphaSubscription[]> {
    const response = await apiClient.get<{
      subscriptions: AlphaSubscription[];
      stats: {
        activeSubscriptions: number;
        totalSubscriptions: number;
        totalFeesPaid: string;
      };
    }>(
      `/api/v1/subscriptions?consumer=${userAddress}`
    );

    // Extract and return just the subscriptions array
    return response.subscriptions || [];
  }

  /**
   * Get pending trades for a consumer
   */
  async getPendingTrades(
    consumerAddress: string
  ): Promise<TradeNotification[]> {
    return apiClient.get<TradeNotification[]>(
      `/api/v1/trades/pending?address=${consumerAddress}`
    );
  }

  /**
   * Execute a trade
   */
  async executeTrade(
    tradeId: string,
    executorAddress: string,
    txHash: string
  ): Promise<{ success: boolean; trade: TradeNotification }> {
    return apiClient.post<{ success: boolean; trade: TradeNotification }>(
      `/api/v1/trades/${tradeId}/execute`,
      {
        executorAddress,
        txHash,
      }
    );
  }

  /**
   * Create an EventSource for SSE notifications
   */
  createNotificationStream(consumerAddress: string): EventSource {
    const baseURL = process.env.NEXT_PUBLIC_ALPHAENGINE_API_URL || 'http://localhost:3001';
    return new EventSource(
      `${baseURL}/api/v1/trades/stream?address=${consumerAddress}`
    );
  }
}

// Export singleton instance
export const alphaEngineClient = new AlphaEngineClient();

// Export types
export type { AlphaEngineClient };