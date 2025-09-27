/**
 * Uniswap Protocol Executor
 * Feature: 003-protocol-strategy-integration
 * Purpose: Execute Uniswap protocol functions (swap operations)
 */

import { ethers } from 'ethers';
import { ProtocolExecutor, ExecutionRequest, ExecutionResponse, GasEstimation, ExecutorConfig } from './types';
import { getProtocolRegistry, FUNCTION_SIGNATURES } from '../protocol-contracts/registry';
import { Pool } from 'pg';

export class UniswapExecutor implements ProtocolExecutor {
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
   * Execute Uniswap protocol function
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    try {
      // Validate request
      const validation = await this.validateRequest(request);
      if (!validation.valid) {
        throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
      }

      if (!this.signer) {
        throw new Error('No signer configured for execution');
      }

      // Get contract details
      const registry = getProtocolRegistry(this.pool);
      const contractDetails = await registry.getContract('UNISWAP', 'SwapRouter', request.network as any);

      if (!contractDetails) {
        throw new Error('Uniswap SwapRouter contract not found');
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
      const txParams = this.buildSwapParams(request.functionName, request.parameters);

      // Execute transaction
      const tx = await contract[request.functionName](
        txParams,
        {
          gasLimit: gasEstimation.gasLimit,
          gasPrice: gasEstimation.gasPrice,
          value: this.getValueForSwap(request.functionName, request.parameters)
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
      console.error('Uniswap execution error:', error);
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
   * Estimate gas for Uniswap transaction
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
      const contractDetails = await registry.getContract('UNISWAP', 'SwapRouter', request.network as any);

      if (!contractDetails) {
        throw new Error('Uniswap SwapRouter contract not found');
      }

      // Create contract instance
      const contract = new ethers.Contract(
        contractDetails.address,
        contractDetails.abi,
        this.provider
      );

      // Build transaction parameters
      const txParams = this.buildSwapParams(request.functionName, request.parameters);

      // Estimate gas
      const gasLimit = await contract[request.functionName].estimateGas(
        txParams,
        {
          from: request.userAddress,
          value: this.getValueForSwap(request.functionName, request.parameters)
        }
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
      // Return fallback estimation (higher for swaps)
      return {
        gasLimit: '300000',
        gasPrice: ethers.parseUnits('20', 'gwei').toString(),
        totalCost: ethers.parseUnits('0.006', 'ether').toString(),
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
    if (request.protocol !== 'UNISWAP') {
      errors.push('Invalid protocol for Uniswap executor');
    }

    // Check function signature
    const signature = FUNCTION_SIGNATURES[request.functionName];
    if (!signature || signature.protocol !== 'UNISWAP') {
      errors.push(`Invalid Uniswap function: ${request.functionName}`);
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

    // Validate token addresses
    if ('tokenIn' in request.parameters && !ethers.isAddress(request.parameters.tokenIn)) {
      errors.push('Invalid tokenIn address');
    }
    if ('tokenOut' in request.parameters && !ethers.isAddress(request.parameters.tokenOut)) {
      errors.push('Invalid tokenOut address');
    }

    // Validate amounts
    const amountFields = ['amountIn', 'amountOut', 'amountInMaximum', 'amountOutMinimum'];
    for (const field of amountFields) {
      if (field in request.parameters) {
        try {
          const amount = BigInt(request.parameters[field]);
          if (amount <= 0n) {
            errors.push(`${field} must be greater than 0`);
          }
        } catch {
          errors.push(`Invalid ${field} format`);
        }
      }
    }

    // Validate deadline
    if ('deadline' in request.parameters) {
      const deadline = Number(request.parameters.deadline);
      if (deadline <= Date.now() / 1000) {
        errors.push('Deadline must be in the future');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build swap parameters object
   */
  private buildSwapParams(functionName: string, params: Record<string, any>): any {
    const signature = FUNCTION_SIGNATURES[functionName];
    if (!signature) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    // Uniswap V3 expects a struct for swap parameters
    if (functionName === 'exactInputSingle' || functionName === 'exactOutputSingle') {
      return {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        fee: BigInt(params.fee || 3000), // Default to 0.3% fee tier
        recipient: params.recipient,
        deadline: BigInt(params.deadline || Math.floor(Date.now() / 1000) + 1200), // 20 minutes
        amountIn: functionName === 'exactInputSingle' ? BigInt(params.amountIn) : undefined,
        amountOut: functionName === 'exactOutputSingle' ? BigInt(params.amountOut) : undefined,
        amountOutMinimum: functionName === 'exactInputSingle' ? BigInt(params.amountOutMinimum || 0) : undefined,
        amountInMaximum: functionName === 'exactOutputSingle' ? BigInt(params.amountInMaximum) : undefined,
        sqrtPriceLimitX96: BigInt(params.sqrtPriceLimitX96 || 0)
      };
    } else if (functionName === 'exactInput') {
      return {
        path: params.path,
        recipient: params.recipient,
        deadline: BigInt(params.deadline || Math.floor(Date.now() / 1000) + 1200),
        amountIn: BigInt(params.amountIn),
        amountOutMinimum: BigInt(params.amountOutMinimum || 0)
      };
    }

    throw new Error(`Unsupported Uniswap function: ${functionName}`);
  }

  /**
   * Get ETH value for swap (if swapping ETH)
   */
  private getValueForSwap(functionName: string, params: Record<string, any>): bigint {
    // Check if tokenIn is WETH address (would need ETH value)
    const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // Mainnet WETH

    if (params.tokenIn === WETH_ADDRESS) {
      if (functionName === 'exactInputSingle' || functionName === 'exactInput') {
        return BigInt(params.amountIn);
      } else if (functionName === 'exactOutputSingle') {
        return BigInt(params.amountInMaximum);
      }
    }

    return BigInt(0);
  }

  /**
   * Generate cache key for gas estimation
   */
  private getCacheKey(request: ExecutionRequest): string {
    const params = Object.keys(request.parameters)
      .sort()
      .map(key => `${key}:${request.parameters[key]}`)
      .join('|');

    return `uniswap:${request.functionName}:${request.network}:${params}`;
  }

  /**
   * Clear gas cache
   */
  clearCache(): void {
    this.gasCache.clear();
  }
}