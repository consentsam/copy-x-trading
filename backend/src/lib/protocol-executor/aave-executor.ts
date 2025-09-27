/**
 * AAVE Protocol Executor
 * Feature: 003-protocol-strategy-integration
 * Purpose: Execute AAVE protocol functions (supply, withdraw, borrow, repay)
 */

import { ethers } from 'ethers';
import { ProtocolExecutor, ExecutionRequest, ExecutionResponse, GasEstimation, ExecutorConfig } from './types';
import { getProtocolRegistry, FUNCTION_SIGNATURES } from '../protocol-contracts/registry';
import { Pool } from 'pg';

export class AAVEExecutor implements ProtocolExecutor {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private config: ExecutorConfig;
  private gasCache: Map<string, { estimation: GasEstimation; expiresAt: number }> = new Map();
  private pool: Pool;

  constructor(config: ExecutorConfig, pool: Pool) {
    this.config = {
      gasMultiplier: 1.2,
      cacheTtl: 30,
      ...config
    };
    this.pool = pool;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, this.provider);
    }
  }

  /**
   * Execute AAVE protocol function
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    try {
      // Validate request
      const validation = await this.validateRequest(request);
      if (!validation.valid) {
        throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
      }

      // In development without signer, return mock response
      if (!this.signer) {
        console.log('[AAVE Executor] Mock mode: No signer configured, returning mock response');
        return {
          success: true,
          transactionHash: `0x${Math.random().toString(36).substring(2)}${'0'.repeat(40)}`.substring(0, 66),
          gasUsed: '150000',
          blockNumber: 1,
          timestamp: Date.now()
        };
      }

      // Get contract details
      const registry = getProtocolRegistry(this.pool);
      const contractDetails = await registry.getContract('AAVE', 'Pool', request.network as any);

      if (!contractDetails) {
        throw new Error('AAVE Pool contract not found');
      }

      // Create contract instance
      const contract = new ethers.Contract(
        contractDetails.address,
        contractDetails.abi,
        this.signer
      );

      // Estimate gas
      const gasEstimation = await this.estimateGas(request);

      // Build transaction parameters
      const txParams = this.buildTransactionParams(request.functionName, request.parameters);

      // Execute transaction
      const tx = await contract[request.functionName](
        ...txParams,
        {
          gasLimit: gasEstimation.gasLimit,
          gasPrice: gasEstimation.gasPrice
        }
      );

      // Wait for confirmation
      const receipt = await tx.wait();

      return {
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        timestamp: new Date()
      };
    } catch (error: any) {
      console.error('AAVE execution error:', error);
      return {
        transactionHash: '',
        gasUsed: '0',
        blockNumber: 0,
        status: 'failed',
        errorMessage: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Estimate gas for AAVE transaction
   */
  async estimateGas(request: ExecutionRequest): Promise<GasEstimation> {
    try {
      // Check cache
      const cacheKey = this.getCacheKey(request);
      const cached = this.gasCache.get(cacheKey);

      if (cached && cached.expiresAt > Date.now()) {
        return cached.estimation;
      }

      // Get contract details
      const registry = getProtocolRegistry(this.pool);
      const contractDetails = await registry.getContract('AAVE', 'Pool', request.network as any);

      if (!contractDetails) {
        throw new Error('AAVE Pool contract not found');
      }

      // Create contract instance
      const contract = new ethers.Contract(
        contractDetails.address,
        contractDetails.abi,
        this.provider
      );

      // Build transaction parameters
      const txParams = this.buildTransactionParams(request.functionName, request.parameters);

      // Estimate gas
      const gasLimit = await contract[request.functionName].estimateGas(
        ...txParams,
        { from: request.userAddress }
      );

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');

      // Apply multiplier for safety
      const adjustedGasLimit = gasLimit * BigInt(Math.floor(this.config.gasMultiplier! * 100)) / BigInt(100);

      // Calculate total cost
      const totalCost = adjustedGasLimit * gasPrice;

      const estimation: GasEstimation = {
        gasLimit: adjustedGasLimit.toString(),
        gasPrice: gasPrice.toString(),
        totalCost: totalCost.toString(),
        estimatedAt: new Date(),
        ttl: this.config.cacheTtl!
      };

      // Cache the estimation
      this.gasCache.set(cacheKey, {
        estimation,
        expiresAt: Date.now() + (this.config.cacheTtl! * 1000)
      });

      return estimation;
    } catch (error: any) {
      console.error('Gas estimation error:', error);
      // Return fallback estimation
      return {
        gasLimit: '500000',
        gasPrice: ethers.parseUnits('20', 'gwei').toString(),
        totalCost: ethers.parseUnits('0.01', 'ether').toString(),
        estimatedAt: new Date(),
        ttl: 0
      };
    }
  }

  /**
   * Validate execution request
   */
  async validateRequest(request: ExecutionRequest): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check protocol
    if (request.protocol !== 'AAVE') {
      errors.push('Invalid protocol for AAVE executor');
    }

    // Check function signature
    const signature = FUNCTION_SIGNATURES[request.functionName];
    if (!signature || signature.protocol !== 'AAVE') {
      errors.push(`Invalid AAVE function: ${request.functionName}`);
    } else {
      // Validate required parameters
      for (const param of signature.requiredParams) {
        if (!(param in request.parameters)) {
          errors.push(`Missing required parameter: ${param}`);
        }
      }
    }

    // Validate addresses
    if (!ethers.isAddress(request.contractAddress)) {
      errors.push('Invalid contract address');
    }
    if (!ethers.isAddress(request.userAddress)) {
      errors.push('Invalid user address');
    }

    // Validate amounts
    if ('amount' in request.parameters) {
      try {
        const amount = BigInt(request.parameters.amount);
        if (amount <= 0n) {
          errors.push('Amount must be greater than 0');
        }
      } catch {
        errors.push('Invalid amount format');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build transaction parameters in correct order
   */
  private buildTransactionParams(functionName: string, params: Record<string, any>): any[] {
    const signature = FUNCTION_SIGNATURES[functionName];
    if (!signature) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    // Return parameters in the order defined by the signature
    return signature.requiredParams.map(param => {
      const value = params[param];

      // Convert amounts to BigInt
      if (param === 'amount' || param.includes('Amount')) {
        return BigInt(value);
      }

      // Handle other types as needed
      return value;
    });
  }

  /**
   * Generate cache key for gas estimation
   */
  private getCacheKey(request: ExecutionRequest): string {
    const params = Object.keys(request.parameters)
      .sort()
      .map(key => `${key}:${request.parameters[key]}`)
      .join('|');

    return `aave:${request.functionName}:${request.network}:${params}`;
  }

  /**
   * Clear gas cache
   */
  clearCache(): void {
    this.gasCache.clear();
  }
}