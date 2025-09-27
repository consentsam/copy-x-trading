/**
 * Protocol Contracts API Contract Tests (TDD - Should fail initially)
 * Feature: 003-protocol-strategy-integration
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const API_PREFIX = '/api/v1';

describe('Protocol Contracts API', () => {
  let authToken: string;

  beforeAll(() => {
    // Mock auth token for testing
    authToken = 'Bearer test-token';
  });

  describe('GET /api/v1/protocol-contracts', () => {
    it('should list all protocol contracts', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            protocol: expect.stringMatching(/AAVE|UNISWAP/),
            contractName: expect.any(String),
            network: expect.any(String),
            address: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
            version: expect.any(String),
            isActive: expect.any(Boolean)
          })
        ])
      });
    });

    it('should filter by protocol', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts?protocol=AAVE`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            protocol: 'AAVE'
          })
        ])
      );
    });

    it('should filter by network', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts?network=mainnet`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            network: 'mainnet'
          })
        ])
      );
    });

    it('should filter by active status', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts?isActive=true`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            isActive: true
          })
        ])
      );
    });
  });

  describe('GET /api/v1/protocol-contracts/:protocol/:contractName', () => {
    it('should get specific protocol contract', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts/AAVE/Pool`)
        .query({ network: 'mainnet' })
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          protocol: 'AAVE',
          contractName: 'Pool',
          network: 'mainnet',
          address: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
          abi: expect.any(Array),
          version: expect.any(String),
          isActive: true
        }
      });
    });

    it('should default to localhost network', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts/UNISWAP/SwapRouter`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          protocol: 'UNISWAP',
          contractName: 'SwapRouter',
          network: 'localhost'
        }
      });
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts/INVALID/Contract`)
        .set('Authorization', authToken)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('not found')
      });
    });
  });

  describe('GET /api/v1/protocol-contracts/:protocol/:contractName/abi', () => {
    it('should get contract ABI only', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts/AAVE/Pool/abi`)
        .query({ network: 'mainnet' })
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          protocol: 'AAVE',
          contractName: 'Pool',
          network: 'mainnet',
          abi: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              type: 'function'
            })
          ])
        }
      });
    });

    it('should include function signatures in ABI', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts/AAVE/Pool/abi`)
        .query({ network: 'mainnet' })
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.abi).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'supply',
            type: 'function',
            inputs: expect.arrayContaining([
              expect.objectContaining({
                name: 'asset',
                type: 'address'
              })
            ])
          })
        ])
      );
    });
  });

  describe('GET /api/v1/protocol-contracts/functions', () => {
    it('should list all available functions', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts/functions`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            displayName: expect.any(String),
            protocol: expect.stringMatching(/AAVE|UNISWAP/),
            requiredParams: expect.any(Array),
            modifiableParams: expect.any(Array)
          })
        ])
      });
    });

    it('should filter functions by protocol', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/protocol-contracts/functions?protocol=UNISWAP`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            protocol: 'UNISWAP',
            name: expect.stringMatching(/exactInputSingle|exactOutputSingle|exactInput/)
          })
        ])
      );
    });
  });

  describe('POST /api/v1/protocol-contracts/estimate-gas', () => {
    it('should estimate gas for protocol function', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/protocol-contracts/estimate-gas`)
        .set('Authorization', authToken)
        .send({
          protocol: 'AAVE',
          contractName: 'Pool',
          functionName: 'supply',
          parameters: {
            asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            amount: '1000000000',
            onBehalfOf: '0x0000000000000000000000000000000000000000',
            referralCode: '0'
          },
          network: 'localhost'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          gasEstimate: expect.stringMatching(/^\d+$/),
          gasPrice: expect.stringMatching(/^\d+$/),
          totalCostWei: expect.stringMatching(/^\d+$/),
          totalCostEth: expect.any(String)
        }
      });
    });

    it('should use cached gas estimates', async () => {
      // First request
      const response1 = await request(BASE_URL)
        .post(`${API_PREFIX}/protocol-contracts/estimate-gas`)
        .set('Authorization', authToken)
        .send({
          protocol: 'UNISWAP',
          contractName: 'SwapRouter',
          functionName: 'exactInputSingle',
          parameters: {
            tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            tokenOut: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            fee: '3000',
            recipient: '0x0000000000000000000000000000000000000000',
            deadline: Math.floor(Date.now() / 1000) + 3600,
            amountIn: '1000000000',
            amountOutMinimum: '0',
            sqrtPriceLimitX96: '0'
          }
        })
        .expect(200);

      // Second request (should use cache)
      const response2 = await request(BASE_URL)
        .post(`${API_PREFIX}/protocol-contracts/estimate-gas`)
        .set('Authorization', authToken)
        .send({
          protocol: 'UNISWAP',
          contractName: 'SwapRouter',
          functionName: 'exactInputSingle',
          parameters: {
            tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            tokenOut: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            fee: '3000',
            recipient: '0x0000000000000000000000000000000000000000',
            deadline: Math.floor(Date.now() / 1000) + 3600,
            amountIn: '1000000000',
            amountOutMinimum: '0',
            sqrtPriceLimitX96: '0'
          }
        })
        .expect(200);

      // Gas estimates should be the same (cached)
      expect(response1.body.data.gasEstimate).toBe(response2.body.data.gasEstimate);
      expect(response2.body.data.cached).toBe(true);
    });

    it('should validate function parameters', async () => {
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/protocol-contracts/estimate-gas`)
        .set('Authorization', authToken)
        .send({
          protocol: 'AAVE',
          contractName: 'Pool',
          functionName: 'supply',
          parameters: {
            asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
            // Missing required parameters
          }
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Missing required parameter')
      });
    });
  });
});