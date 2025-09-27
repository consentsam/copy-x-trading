/**
 * Protocol Contract Registry
 * Feature: 003-protocol-strategy-integration
 * Purpose: Central registry for protocol contract ABIs and configurations
 */

import { Pool } from 'pg';
import aavePoolAbi from './abis/aave-pool.json';
import uniswapRouterAbi from './abis/uniswap-router.json';

export type ProtocolType = 'AAVE' | 'UNISWAP';
export type NetworkType = 'mainnet' | 'localhost' | 'testnet';

export interface ProtocolContract {
  id: string;
  protocol: ProtocolType;
  contractName: string;
  network: NetworkType;
  address: string;
  abi: any[];
  version: string;
  isActive: boolean;
  updatedAt: Date;
}

export interface FunctionSignature {
  name: string;
  displayName: string;
  requiredParams: string[];
  modifiableParams: string[];
  protocol: ProtocolType;
}

// Function signature mappings for each protocol
export const FUNCTION_SIGNATURES: Record<string, FunctionSignature> = {
  // AAVE Functions
  'supply': {
    name: 'supply',
    displayName: 'Supply Asset',
    requiredParams: ['asset', 'amount', 'onBehalfOf', 'referralCode'],
    modifiableParams: ['amount'],
    protocol: 'AAVE'
  },
  'withdraw': {
    name: 'withdraw',
    displayName: 'Withdraw Asset',
    requiredParams: ['asset', 'amount', 'to'],
    modifiableParams: ['amount'],
    protocol: 'AAVE'
  },
  'borrow': {
    name: 'borrow',
    displayName: 'Borrow Asset',
    requiredParams: ['asset', 'amount', 'interestRateMode', 'referralCode', 'onBehalfOf'],
    modifiableParams: ['amount'],
    protocol: 'AAVE'
  },
  'repay': {
    name: 'repay',
    displayName: 'Repay Debt',
    requiredParams: ['asset', 'amount', 'interestRateMode', 'onBehalfOf'],
    modifiableParams: ['amount'],
    protocol: 'AAVE'
  },
  // Uniswap Functions
  'exactInputSingle': {
    name: 'exactInputSingle',
    displayName: 'Swap Exact Input',
    requiredParams: ['tokenIn', 'tokenOut', 'fee', 'recipient', 'deadline', 'amountIn', 'amountOutMinimum', 'sqrtPriceLimitX96'],
    modifiableParams: ['amountIn', 'amountOutMinimum'],
    protocol: 'UNISWAP'
  },
  'exactOutputSingle': {
    name: 'exactOutputSingle',
    displayName: 'Swap Exact Output',
    requiredParams: ['tokenIn', 'tokenOut', 'fee', 'recipient', 'deadline', 'amountOut', 'amountInMaximum', 'sqrtPriceLimitX96'],
    modifiableParams: ['amountOut', 'amountInMaximum'],
    protocol: 'UNISWAP'
  },
  'exactInput': {
    name: 'exactInput',
    displayName: 'Multi-hop Swap',
    requiredParams: ['path', 'recipient', 'deadline', 'amountIn', 'amountOutMinimum'],
    modifiableParams: ['amountIn', 'amountOutMinimum'],
    protocol: 'UNISWAP'
  }
};

// ABI mappings
export const CONTRACT_ABIS: Record<string, any[]> = {
  'AAVE_Pool': aavePoolAbi,
  'UNISWAP_SwapRouter': uniswapRouterAbi
};

export class ProtocolContractRegistry {
  private pool: Pool;
  private cache: Map<string, ProtocolContract> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get protocol contract from database
   */
  async getContract(
    protocol: ProtocolType,
    contractName: string,
    network: NetworkType = 'localhost'
  ): Promise<ProtocolContract | null> {
    const cacheKey = `${protocol}_${contractName}_${network}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const query = `
        SELECT * FROM protocol_contracts
        WHERE protocol = $1
          AND contract_name = $2
          AND network = $3
          AND is_active = true
        LIMIT 1
      `;

      const result = await this.pool.query(query, [protocol, contractName, network]);

      if (result.rows.length === 0) {
        return null;
      }

      const contract = {
        id: result.rows[0].id,
        protocol: result.rows[0].protocol,
        contractName: result.rows[0].contract_name,
        network: result.rows[0].network,
        address: result.rows[0].address,
        abi: result.rows[0].abi,
        version: result.rows[0].version,
        isActive: result.rows[0].is_active,
        updatedAt: result.rows[0].updated_at
      };

      // Cache for 5 minutes
      this.cache.set(cacheKey, contract);
      setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

      return contract;
    } catch (error) {
      console.error('Error fetching protocol contract:', error);
      throw error;
    }
  }

  /**
   * Get all contracts for a protocol
   */
  async getProtocolContracts(protocol: ProtocolType): Promise<ProtocolContract[]> {
    try {
      const query = `
        SELECT * FROM protocol_contracts
        WHERE protocol = $1 AND is_active = true
        ORDER BY network, contract_name
      `;

      const result = await this.pool.query(query, [protocol]);

      return result.rows.map(row => ({
        id: row.id,
        protocol: row.protocol,
        contractName: row.contract_name,
        network: row.network,
        address: row.address,
        abi: row.abi,
        version: row.version,
        isActive: row.is_active,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error fetching protocol contracts:', error);
      throw error;
    }
  }

  /**
   * Validate function parameters against signature
   */
  validateFunctionParams(
    functionName: string,
    params: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const signature = FUNCTION_SIGNATURES[functionName];
    if (!signature) {
      return { valid: false, errors: [`Unknown function: ${functionName}`] };
    }

    const errors: string[] = [];
    const providedKeys = Object.keys(params);

    // Check required parameters
    for (const required of signature.requiredParams) {
      if (!providedKeys.includes(required)) {
        errors.push(`Missing required parameter: ${required}`);
      }
    }

    // Check for unknown parameters
    for (const key of providedKeys) {
      if (!signature.requiredParams.includes(key)) {
        errors.push(`Unknown parameter: ${key}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if parameters can be modified
   */
  canModifyParams(
    functionName: string,
    modifiedParams: string[]
  ): boolean {
    const signature = FUNCTION_SIGNATURES[functionName];
    if (!signature) return false;

    return modifiedParams.every(param =>
      signature.modifiableParams.includes(param)
    );
  }

  /**
   * Get function ABI from contract ABI
   */
  getFunctionAbi(contractAbi: any[], functionName: string): any | null {
    return contractAbi.find(item =>
      item.type === 'function' && item.name === functionName
    ) || null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export factory function - creates new instance per request
export function getProtocolRegistry(pool: Pool): ProtocolContractRegistry {
  return new ProtocolContractRegistry(pool);
}