/**
 * Protocol Executor Main Module
 * Feature: 003-protocol-strategy-integration
 * Purpose: Central interface for executing DeFi protocol functions
 */

import { Pool } from 'pg';
import { AAVEExecutor } from './aave-executor';
import { UniswapExecutor } from './uniswap-executor';
import {
  ExecutionRequest,
  ExecutionResponse,
  GasEstimation,
  ExecutorConfig,
  ProtocolExecutor
} from './types';
import { ProtocolType } from '../protocol-contracts/registry';

export * from './types';

export class ProtocolExecutorService {
  private executors: Map<ProtocolType, ProtocolExecutor>;
  private pool: Pool;
  private config: ExecutorConfig;

  constructor(pool: Pool, config?: Partial<ExecutorConfig>) {
    this.pool = pool;
    this.config = {
      rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
      gasMultiplier: 1.2,
      cacheTtl: 30,
      ...config
    };

    // Initialize protocol executors
    this.executors = new Map();
    this.executors.set('AAVE', new AAVEExecutor(this.config, pool));
    this.executors.set('UNISWAP', new UniswapExecutor(this.config, pool));
  }

  /**
   * Execute a protocol function
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const executor = this.getExecutor(request.protocol);
    return executor.execute(request);
  }

  /**
   * Estimate gas for a protocol function
   */
  async estimateGas(request: ExecutionRequest): Promise<GasEstimation> {
    const executor = this.getExecutor(request.protocol);
    return executor.estimateGas(request);
  }

  /**
   * Validate an execution request
   */
  async validateRequest(request: ExecutionRequest): Promise<{ valid: boolean; errors: string[] }> {
    const executor = this.getExecutor(request.protocol);
    return executor.validateRequest(request);
  }

  /**
   * Execute a strategy (multiple protocol functions)
   */
  async executeStrategy(
    strategyId: string,
    functions: Array<{
      functionName: string;
      protocol: ProtocolType;
      parameters: Record<string, any>;
    }>,
    userAddress: string,
    network: string = 'localhost'
  ): Promise<{
    strategyId: string;
    executions: ExecutionResponse[];
    totalGasUsed: string;
    success: boolean;
  }> {
    const executions: ExecutionResponse[] = [];
    let totalGasUsed = BigInt(0);
    let success = true;

    console.log(`Executing strategy ${strategyId} with ${functions.length} functions`);

    for (const func of functions) {
      try {
        // Get contract address from registry
        const contractName = func.protocol === 'AAVE' ? 'Pool' : 'SwapRouter';
        const registry = await import('../protocol-contracts/registry');
        const protocolRegistry = registry.getProtocolRegistry(this.pool);
        const contract = await protocolRegistry.getContract(func.protocol, contractName, network as any);

        if (!contract) {
          throw new Error(`Contract not found for ${func.protocol} ${contractName}`);
        }

        const request: ExecutionRequest = {
          functionName: func.functionName,
          protocol: func.protocol,
          parameters: func.parameters,
          contractAddress: contract.address,
          network,
          userAddress
        };

        const result = await this.execute(request);
        executions.push(result);

        if (result.status === 'success') {
          totalGasUsed += BigInt(result.gasUsed);
        } else {
          success = false;
          console.error(`Function ${func.functionName} failed:`, result.errorMessage);
          break; // Stop on first failure
        }
      } catch (error: any) {
        console.error(`Error executing ${func.functionName}:`, error);
        executions.push({
          transactionHash: '',
          gasUsed: '0',
          blockNumber: 0,
          status: 'failed',
          errorMessage: error.message,
          timestamp: new Date()
        });
        success = false;
        break;
      }
    }

    return {
      strategyId,
      executions,
      totalGasUsed: totalGasUsed.toString(),
      success
    };
  }

  /**
   * Batch estimate gas for multiple functions
   */
  async batchEstimateGas(
    functions: Array<{
      functionName: string;
      protocol: ProtocolType;
      parameters: Record<string, any>;
    }>,
    userAddress: string,
    network: string = 'localhost'
  ): Promise<{
    estimates: GasEstimation[];
    totalEstimatedCost: string;
  }> {
    const estimates: GasEstimation[] = [];
    let totalCost = BigInt(0);

    for (const func of functions) {
      try {
        // Get contract address from registry
        const contractName = func.protocol === 'AAVE' ? 'Pool' : 'SwapRouter';
        const registry = await import('../protocol-contracts/registry');
        const protocolRegistry = registry.getProtocolRegistry(this.pool);
        const contract = await protocolRegistry.getContract(func.protocol, contractName, network as any);

        if (!contract) {
          throw new Error(`Contract not found for ${func.protocol} ${contractName}`);
        }

        const request: ExecutionRequest = {
          functionName: func.functionName,
          protocol: func.protocol,
          parameters: func.parameters,
          contractAddress: contract.address,
          network,
          userAddress
        };

        const estimate = await this.estimateGas(request);
        estimates.push(estimate);
        totalCost += BigInt(estimate.totalCost);
      } catch (error: any) {
        console.error(`Error estimating gas for ${func.functionName}:`, error);
        // Add fallback estimate
        estimates.push({
          gasLimit: '500000',
          gasPrice: '20000000000', // 20 gwei
          totalCost: '10000000000000000', // 0.01 ETH
          estimatedAt: new Date(),
          ttl: 0
        });
        totalCost += BigInt('10000000000000000');
      }
    }

    return {
      estimates,
      totalEstimatedCost: totalCost.toString()
    };
  }

  /**
   * Get executor for a specific protocol
   */
  private getExecutor(protocol: ProtocolType): ProtocolExecutor {
    const executor = this.executors.get(protocol);
    if (!executor) {
      throw new Error(`No executor found for protocol: ${protocol}`);
    }
    return executor;
  }

  /**
   * Update executor configuration
   */
  updateConfig(config: Partial<ExecutorConfig>): void {
    this.config = { ...this.config, ...config };

    // Recreate executors with new config
    this.executors.set('AAVE', new AAVEExecutor(this.config, this.pool));
    this.executors.set('UNISWAP', new UniswapExecutor(this.config, this.pool));
  }

  /**
   * Clear all gas caches
   */
  clearCaches(): void {
    (this.executors.get('AAVE') as AAVEExecutor)?.clearCache();
    (this.executors.get('UNISWAP') as UniswapExecutor)?.clearCache();
  }
}

// Export factory function - creates new instance per request
export function getProtocolExecutor(pool: Pool, config?: Partial<ExecutorConfig>): ProtocolExecutorService {
  return new ProtocolExecutorService(pool, config);
}