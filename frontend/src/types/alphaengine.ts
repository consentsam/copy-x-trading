/**
 * AlphaEngine Type Definitions
 * Complete types matching backend schema exactly
 */

/**
 * Strategy represents an alpha generation strategy
 */
export interface Strategy {
  strategyId: string;
  strategyName: string;
  strategyDescription?: string;
  supportedProtocols?: string[];
  strategyJSON?: Record<string, unknown>; // JSON configuration
  alphaGeneratorAddress: string;
  subscriberCount: number;
  totalVolume: string; // Wei amount as string
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  executionStats?: StrategyExecutionStats;
}

export interface StrategyExecutionStats {
  totalTrades: number;
  executedTrades: number;
  pendingTrades: number;
  executionRate: number;
}

/**
 * Subscription represents a consumer's subscription to a strategy
 */
export interface Subscription {
  subscriptionId: string;
  strategyId: string;
  alphaConsumerAddress: string;
  subscriptionTxHash: string;
  subscribedAt: string;
  isActive: boolean;
  alphaGeneratorAddress?: string;
  encryptedConsumerAddress?: string;
  subscriptionType?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * TradeConfirmation represents a pending trade for execution
 */
export interface TradeConfirmation {
  confirmationId: string;
  strategyId: string;
  alphaConsumerAddress: string;
  executionParams: {
    protocol: string;
    action: string;
    tokenIn?: string;
    tokenOut?: string;
    amount?: string;
    data?: Record<string, unknown>;
  };
  gasEstimate?: string;
  isExecuted: boolean;
  executionTxHash?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Subscriber represents a simplified view of a strategy subscriber
 */
export interface Subscriber {
  subscriptionId: string;
  alphaConsumerAddress: string;
  subscribedAt: string;
  isActive: boolean;
  subscriptionFee?: string;
  metadata?: Record<string, unknown>;
}

/**
 * API Response wrapper types
 */
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

/**
 * Strategy creation input
 */
export interface CreateStrategyInput {
  strategyName: string;
  strategyDescription?: string;
  supportedProtocols: string[];
  strategyJSON: Record<string, unknown>;
  alphaGeneratorAddress: string;
}

/**
 * Subscription registration input
 */
export interface RegisterSubscriptionInput {
  strategyId: string;
  alphaConsumerAddress: string;
  subscriptionTxHash: string;
}

/**
 * Broadcast confirmation input
 */
export interface BroadcastConfirmationInput {
  strategyId: string;
  executionParams: TradeConfirmation['executionParams'];
  gasEstimate?: string;
}
