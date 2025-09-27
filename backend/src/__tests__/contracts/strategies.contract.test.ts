/**
 * Strategy API Contract Tests (TDD - Should fail initially)
 * Feature: 003-protocol-strategy-integration
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const API_PREFIX = '/api/v1';

describe('Strategy API Contracts', () => {
  let authToken: string;
  let testGeneratorId: string;

  beforeAll(async () => {
    // Mock auth token for testing
    authToken = 'Bearer test-token';
    testGeneratorId = 'test-generator-id';
  });

  describe('POST /api/v1/strategies', () => {
    it('should create a new strategy', async () => {
      const payload = {
        alphaGeneratorId: testGeneratorId,
        name: 'Test AAVE Yield Strategy',
        description: 'Supply and withdraw USDC on AAVE',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw']
      };

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies`)
        .set('Authorization', authToken)
        .send(payload)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          name: payload.name,
          protocol: payload.protocol,
          functions: expect.arrayContaining([
            expect.objectContaining({
              functionName: 'supply',
              displayName: expect.any(String)
            })
          ])
        }
      });
    });

    it('should reject strategy with duplicate name', async () => {
      const payload = {
        alphaGeneratorId: testGeneratorId,
        name: 'Duplicate Strategy Name',
        description: 'Test',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw']
      };

      // Create first strategy
      await request(BASE_URL)
        .post(`${API_PREFIX}/strategies`)
        .set('Authorization', authToken)
        .send(payload)
        .expect(201);

      // Try to create duplicate
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies`)
        .set('Authorization', authToken)
        .send(payload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists')
      });
    });

    it('should reject strategy with invalid function count', async () => {
      const payload = {
        alphaGeneratorId: testGeneratorId,
        name: 'Invalid Function Count',
        description: 'Test',
        protocol: 'AAVE',
        functions: ['supply'] // Only 1 function
      };

      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies`)
        .set('Authorization', authToken)
        .send(payload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('2-3 functions')
      });
    });

    it('should require authentication', async () => {
      const payload = {
        alphaGeneratorId: testGeneratorId,
        name: 'Unauthorized Strategy',
        description: 'Test',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw']
      };

      await request(BASE_URL)
        .post(`${API_PREFIX}/strategies`)
        .send(payload)
        .expect(401);
    });
  });

  describe('GET /api/v1/strategies', () => {
    it('should list all strategies', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/strategies`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            protocol: expect.any(String),
            isActive: expect.any(Boolean)
          })
        ])
      });
    });

    it('should filter strategies by protocol', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/strategies?protocol=AAVE`)
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

    it('should filter strategies by generator', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/strategies?generatorId=${testGeneratorId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            alphaGeneratorId: testGeneratorId
          })
        ])
      );
    });
  });

  describe('GET /api/v1/strategies/:id', () => {
    it('should get a specific strategy', async () => {
      // First create a strategy
      const createResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies`)
        .set('Authorization', authToken)
        .send({
          alphaGeneratorId: testGeneratorId,
          name: 'Test Get Strategy',
          description: 'Test',
          protocol: 'UNISWAP',
          functions: ['exactInputSingle', 'exactOutputSingle']
        })
        .expect(201);

      const strategyId = createResponse.body.data.id;

      // Get the strategy
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/strategies/${strategyId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: strategyId,
          name: 'Test Get Strategy',
          protocol: 'UNISWAP',
          functions: expect.arrayContaining([
            expect.objectContaining({
              functionName: 'exactInputSingle'
            })
          ])
        }
      });
    });

    it('should return 404 for non-existent strategy', async () => {
      const response = await request(BASE_URL)
        .get(`${API_PREFIX}/strategies/non-existent-id`)
        .set('Authorization', authToken)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('not found')
      });
    });
  });

  describe('PUT /api/v1/strategies/:id', () => {
    it('should update a strategy', async () => {
      // First create a strategy
      const createResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies`)
        .set('Authorization', authToken)
        .send({
          alphaGeneratorId: testGeneratorId,
          name: 'Test Update Strategy',
          description: 'Original description',
          protocol: 'AAVE',
          functions: ['supply', 'withdraw']
        })
        .expect(201);

      const strategyId = createResponse.body.data.id;

      // Update the strategy
      const response = await request(BASE_URL)
        .put(`${API_PREFIX}/strategies/${strategyId}`)
        .set('Authorization', authToken)
        .send({
          description: 'Updated description',
          isActive: false
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: strategyId,
          description: 'Updated description',
          isActive: false
        }
      });
    });

    it('should not allow updating strategy of another generator', async () => {
      // This test assumes proper authorization is in place
      const response = await request(BASE_URL)
        .put(`${API_PREFIX}/strategies/other-generator-strategy`)
        .set('Authorization', authToken)
        .send({
          description: 'Unauthorized update'
        })
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('not authorized')
      });
    });
  });

  describe('POST /api/v1/strategies/:id/execute', () => {
    it('should execute a strategy function', async () => {
      // First create a strategy
      const createResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies`)
        .set('Authorization', authToken)
        .send({
          alphaGeneratorId: testGeneratorId,
          name: 'Test Execute Strategy',
          description: 'Test',
          protocol: 'AAVE',
          functions: ['supply', 'withdraw']
        })
        .expect(201);

      const strategyId = createResponse.body.data.id;

      // Execute the strategy
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies/${strategyId}/execute`)
        .set('Authorization', authToken)
        .send({
          functionName: 'supply',
          parameters: {
            asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
            amount: '1000000000',
            onBehalfOf: '0x0000000000000000000000000000000000000000',
            referralCode: '0'
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          broadcastId: expect.any(String),
          correlationId: expect.any(String),
          subscriberCount: expect.any(Number),
          gasEstimate: expect.any(String)
        }
      });
    });

    it('should validate required parameters', async () => {
      // Create strategy first
      const createResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies`)
        .set('Authorization', authToken)
        .send({
          alphaGeneratorId: testGeneratorId,
          name: 'Test Validate Params',
          description: 'Test',
          protocol: 'AAVE',
          functions: ['supply', 'withdraw']
        })
        .expect(201);

      const strategyId = createResponse.body.data.id;

      // Try to execute with missing parameters
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies/${strategyId}/execute`)
        .set('Authorization', authToken)
        .send({
          functionName: 'supply',
          parameters: {
            asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
            // Missing amount, onBehalfOf, referralCode
          }
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('required parameter')
      });
    });

    it('should reject execution of inactive strategy', async () => {
      // Create and deactivate strategy
      const createResponse = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies`)
        .set('Authorization', authToken)
        .send({
          alphaGeneratorId: testGeneratorId,
          name: 'Test Inactive Strategy',
          description: 'Test',
          protocol: 'AAVE',
          functions: ['supply', 'withdraw']
        })
        .expect(201);

      const strategyId = createResponse.body.data.id;

      // Deactivate strategy
      await request(BASE_URL)
        .put(`${API_PREFIX}/strategies/${strategyId}`)
        .set('Authorization', authToken)
        .send({ isActive: false })
        .expect(200);

      // Try to execute
      const response = await request(BASE_URL)
        .post(`${API_PREFIX}/strategies/${strategyId}/execute`)
        .set('Authorization', authToken)
        .send({
          functionName: 'supply',
          parameters: {
            asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            amount: '1000000000',
            onBehalfOf: '0x0000000000000000000000000000000000000000',
            referralCode: '0'
          }
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('inactive')
      });
    });
  });
});