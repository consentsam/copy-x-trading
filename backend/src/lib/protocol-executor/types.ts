/**
 * Protocol Executor Types
 * Feature: 003-protocol-strategy-integration
 * Purpose: Type definitions for protocol execution
 */

import { ProtocolType } from '../protocol-contracts/registry';

export interface ExecutionRequest {
  functionName: string;
  protocol: ProtocolType;
  parameters: Record<string, any>;
  contractAddress: string;
  network: string;
  userAddress: string;
}

export interface ExecutionResponse {
  transactionHash: string;
  gasUsed: string;
  blockNumber: number;
  status: 'success' | 'failed';
  errorMessage?: string;
  timestamp: Date;
}

export interface GasEstimation {
  gasLimit: string;
  gasPrice: string;
  totalCost: string;
  estimatedAt: Date;
  ttl: number; // Time to live in seconds
}

export interface ExecutorConfig {
  rpcUrl: string;
  privateKey?: string;
  gasMultiplier?: number; // Default 1.2 (20% buffer)
  cacheTtl?: number; // Default 30 seconds
}

export interface ProtocolExecutor {
  execute(request: ExecutionRequest): Promise<ExecutionResponse>;
  estimateGas(request: ExecutionRequest): Promise<GasEstimation>;
  validateRequest(request: ExecutionRequest): Promise<{ valid: boolean; errors: string[] }>;
}