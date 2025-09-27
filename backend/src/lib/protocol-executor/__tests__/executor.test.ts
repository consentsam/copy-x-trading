/**
 * Protocol Executor Tests
 * Feature: 003-protocol-strategy-integration
 */

import { getProtocolExecutor, ProtocolExecutorService } from '../index';
import { ExecutionRequest } from '../types';
import { Pool } from 'pg';

// Mock dependencies
jest.mock('pg');
jest.mock('ethers');

describe('ProtocolExecutorService', () => {
  let pool: jest.Mocked<Pool>;
  let executor: ProtocolExecutorService;

  beforeEach(() => {
    pool = new Pool() as jest.Mocked<Pool>;
    executor = getProtocolExecutor(pool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRequest', () => {
    it('should validate AAVE supply request', async () => {
      const request: ExecutionRequest = {
        functionName: 'supply',
        protocol: 'AAVE',
        parameters: {
          asset: '0x0000000000000000000000000000000000000001',
          amount: '1000000000000000000',
          onBehalfOf: '0x0000000000000000000000000000000000000002',
          referralCode: 0
        },
        contractAddress: '0x0000000000000000000000000000000000000003',
        network: 'localhost',
        userAddress: '0x0000000000000000000000000000000000000004'
      };

      const result = await executor.validateRequest(request);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject request with missing parameters', async () => {
      const request: ExecutionRequest = {
        functionName: 'supply',
        protocol: 'AAVE',
        parameters: {
          asset: '0x0000000000000000000000000000000000000001'
          // Missing amount, onBehalfOf, referralCode
        },
        contractAddress: '0x0000000000000000000000000000000000000003',
        network: 'localhost',
        userAddress: '0x0000000000000000000000000000000000000004'
      };

      const result = await executor.validateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: amount');
    });

    it('should validate Uniswap swap request', async () => {
      const request: ExecutionRequest = {
        functionName: 'exactInputSingle',
        protocol: 'UNISWAP',
        parameters: {
          tokenIn: '0x0000000000000000000000000000000000000001',
          tokenOut: '0x0000000000000000000000000000000000000002',
          fee: 3000,
          recipient: '0x0000000000000000000000000000000000000003',
          deadline: Math.floor(Date.now() / 1000) + 3600,
          amountIn: '1000000000000000000',
          amountOutMinimum: '900000000000000000',
          sqrtPriceLimitX96: 0
        },
        contractAddress: '0x0000000000000000000000000000000000000004',
        network: 'localhost',
        userAddress: '0x0000000000000000000000000000000000000005'
      };

      const result = await executor.validateRequest(request);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid protocol', async () => {
      const request: ExecutionRequest = {
        functionName: 'supply',
        protocol: 'INVALID' as any,
        parameters: {},
        contractAddress: '0x0000000000000000000000000000000000000001',
        network: 'localhost',
        userAddress: '0x0000000000000000000000000000000000000002'
      };

      await expect(executor.validateRequest(request))
        .rejects
        .toThrow('No executor found for protocol: INVALID');
    });
  });

  describe('estimateGas', () => {
    it('should return gas estimation for AAVE supply', async () => {
      const request: ExecutionRequest = {
        functionName: 'supply',
        protocol: 'AAVE',
        parameters: {
          asset: '0x0000000000000000000000000000000000000001',
          amount: '1000000000000000000',
          onBehalfOf: '0x0000000000000000000000000000000000000002',
          referralCode: 0
        },
        contractAddress: '0x0000000000000000000000000000000000000003',
        network: 'localhost',
        userAddress: '0x0000000000000000000000000000000000000004'
      };

      const estimation = await executor.estimateGas(request);

      expect(estimation).toHaveProperty('gasLimit');
      expect(estimation).toHaveProperty('gasPrice');
      expect(estimation).toHaveProperty('totalCost');
      expect(estimation).toHaveProperty('estimatedAt');
      expect(estimation).toHaveProperty('ttl');
      expect(Number(estimation.gasLimit)).toBeGreaterThan(0);
    });

    it('should cache gas estimations', async () => {
      const request: ExecutionRequest = {
        functionName: 'supply',
        protocol: 'AAVE',
        parameters: {
          asset: '0x0000000000000000000000000000000000000001',
          amount: '1000000000000000000',
          onBehalfOf: '0x0000000000000000000000000000000000000002',
          referralCode: 0
        },
        contractAddress: '0x0000000000000000000000000000000000000003',
        network: 'localhost',
        userAddress: '0x0000000000000000000000000000000000000004'
      };

      const estimation1 = await executor.estimateGas(request);
      const estimation2 = await executor.estimateGas(request);

      // Should return cached result (same timestamp)
      expect(estimation1.estimatedAt).toEqual(estimation2.estimatedAt);
    });
  });

  describe('batchEstimateGas', () => {
    it('should estimate gas for multiple functions', async () => {
      const functions = [
        {
          functionName: 'supply',
          protocol: 'AAVE' as const,
          parameters: {
            asset: '0x0000000000000000000000000000000000000001',
            amount: '1000000000000000000',
            onBehalfOf: '0x0000000000000000000000000000000000000002',
            referralCode: 0
          }
        },
        {
          functionName: 'exactInputSingle',
          protocol: 'UNISWAP' as const,
          parameters: {
            tokenIn: '0x0000000000000000000000000000000000000001',
            tokenOut: '0x0000000000000000000000000000000000000002',
            fee: 3000,
            recipient: '0x0000000000000000000000000000000000000003',
            deadline: Math.floor(Date.now() / 1000) + 3600,
            amountIn: '1000000000000000000',
            amountOutMinimum: '900000000000000000',
            sqrtPriceLimitX96: 0
          }
        }
      ];

      const result = await executor.batchEstimateGas(
        functions,
        '0x0000000000000000000000000000000000000005',
        'localhost'
      );

      expect(result.estimates).toHaveLength(2);
      expect(Number(result.totalEstimatedCost)).toBeGreaterThan(0);
    });
  });

  describe('clearCaches', () => {
    it('should clear all gas caches', () => {
      expect(() => executor.clearCaches()).not.toThrow();
    });
  });

  describe('updateConfig', () => {
    it('should update executor configuration', () => {
      expect(() => executor.updateConfig({
        gasMultiplier: 1.5,
        cacheTtl: 60
      })).not.toThrow();
    });
  });
});