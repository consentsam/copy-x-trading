/**
 * Trade Broadcast Types
 * Feature: 003-protocol-strategy-integration
 * Purpose: Type definitions for trade broadcasting
 */

import { ProtocolType } from '../protocol-contracts/registry';

export interface TradeBroadcast {
  id: string;
  strategyId: string;
  alphaGeneratorId?: string | null;
  functionName: string;
  protocol: ProtocolType;
  parameters: Record<string, any>;
  contractAddress: string;
  gasEstimate: string;
  network: string;
  correlationId: string;
  broadcastAt: Date;
  expiresAt: Date;
}

export interface BroadcastRequest {
  strategyId: string;
  alphaGeneratorId?: string | null;
  functionName: string;
  protocol: ProtocolType;
  parameters: Record<string, any>;
  gasEstimate: string;
  network?: string;
  expiryMinutes?: number; // Default 5 minutes
}

export interface BroadcastResponse {
  broadcastId: string;
  correlationId: string;
  recipientCount: number;
  broadcastAt: Date;
  expiresAt: Date;
}

export interface TradeConfirmation {
  id: string;
  tradeBroadcastId: string;
  alphaConsumerId: string;
  originalParameters: Record<string, any>;
  modifiedParameters: Record<string, any>;
  status: TradeStatus;
  gasPrice?: string;
  transactionHash?: string;
  errorMessage?: string;
  receivedAt: Date;
  decidedAt?: Date;
  executedAt?: Date;
}

export type TradeStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED';

export interface BroadcastStatistics {
  totalBroadcasts: number;
  activeBroadcasts: number;
  expiredBroadcasts: number;
  averageRecipients: number;
  successRate: number;
}

export interface SubscriberNotification {
  subscriberId: string;
  tradeBroadcast: TradeBroadcast;
  strategyName: string;
  alphaGeneratorName: string;
}