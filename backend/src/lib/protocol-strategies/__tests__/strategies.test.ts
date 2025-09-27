/**
 * Protocol Strategies Library Tests
 * Feature: 003-protocol-strategy-integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Pool } from 'pg';
import { createProtocolStrategiesLib } from '../index';
import { CreateStrategyInput } from '../types';

describe('Protocol Strategies Library', () => {
  let pool: Pool;
  let strategiesLib: ReturnType<typeof createProtocolStrategiesLib>;
  let testGeneratorId: string;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://consentsam:@localhost:5432/alphaengine'
    });

    strategiesLib = createProtocolStrategiesLib(pool);

    // Get or create a test generator
    const generatorResult = await pool.query(
      'SELECT generator_id FROM alpha_generators LIMIT 1'
    );

    if (generatorResult.rows.length > 0) {
      testGeneratorId = generatorResult.rows[0].generator_id;
    } else {
      // Create a test generator
      const createResult = await pool.query(
        `INSERT INTO alpha_generators (wallet_address, display_name)
         VALUES ('0xtest', 'Test Generator')
         RETURNING generator_id`
      );
      testGeneratorId = createResult.rows[0].generator_id;
    }
  });

  afterAll(async () => {
    // Clean up test data from unified strategies table
    // Get generator address for cleanup
    const generatorResult = await pool.query(
      'SELECT generator_address FROM alpha_generators WHERE generator_id = $1',
      [testGeneratorId]
    );

    if (generatorResult.rows.length > 0) {
      await pool.query(
        'DELETE FROM strategies WHERE alpha_generator_address = $1',
        [generatorResult.rows[0].generator_address.toLowerCase()]
      );
    }
    await pool.end();
  });

  beforeEach(async () => {
    // Clean strategies before each test
    await pool.query(
      'DELETE FROM strategies WHERE strategy_name LIKE $1',
      ['Test Strategy%']
    );
  });

  describe('createStrategy', () => {
    it('should create a strategy with valid input', async () => {
      const input: CreateStrategyInput = {
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy AAVE',
        description: 'Test AAVE strategy',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw']
      };

      const strategy = await strategiesLib.createStrategy(input);

      expect(strategy).toBeDefined();
      expect(strategy.name).toBe(input.name);
      expect(strategy.protocol).toBe(input.protocol);
      expect(strategy.functions).toHaveLength(2);
      expect(strategy.functions[0].functionName).toBe('supply');
      expect(strategy.functions[1].functionName).toBe('withdraw');
      expect(strategy.isActive).toBe(true);
    });

    it('should reject strategy with duplicate name', async () => {
      const input: CreateStrategyInput = {
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy Duplicate',
        description: 'Test strategy',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw']
      };

      await strategiesLib.createStrategy(input);

      // Try to create another with same name
      await expect(
        strategiesLib.createStrategy(input)
      ).rejects.toThrow('already exists globally');
    });

    it('should reject strategy with less than 2 functions', async () => {
      const input: CreateStrategyInput = {
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy Single',
        description: 'Test strategy',
        protocol: 'AAVE',
        functions: ['supply']
      };

      await expect(
        strategiesLib.createStrategy(input)
      ).rejects.toThrow('Strategy must have 2-3 functions');
    });

    it('should reject strategy with more than 3 functions', async () => {
      const input: CreateStrategyInput = {
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy Many',
        description: 'Test strategy',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw', 'borrow', 'repay']
      };

      await expect(
        strategiesLib.createStrategy(input)
      ).rejects.toThrow('Strategy must have 2-3 functions');
    });

    it('should reject strategy with invalid function for protocol', async () => {
      const input: CreateStrategyInput = {
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy Invalid',
        description: 'Test strategy',
        protocol: 'AAVE',
        functions: ['supply', 'exactInputSingle'] // Uniswap function on AAVE
      };

      await expect(
        strategiesLib.createStrategy(input)
      ).rejects.toThrow('not available for protocol AAVE');
    });
  });

  describe('updateStrategy', () => {
    it('should update strategy name', async () => {
      const strategy = await strategiesLib.createStrategy({
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy Update',
        description: 'Test strategy',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw']
      });

      const updated = await strategiesLib.updateStrategy(strategy.id, {
        name: 'Test Strategy Updated Name'
      });

      expect(updated.name).toBe('Test Strategy Updated Name');
      expect(updated.id).toBe(strategy.id);
    });

    it('should activate/deactivate strategy', async () => {
      const strategy = await strategiesLib.createStrategy({
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy Active',
        description: 'Test strategy',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw']
      });

      // Deactivate
      let updated = await strategiesLib.updateStrategy(strategy.id, {
        isActive: false
      });
      expect(updated.isActive).toBe(false);

      // Activate
      updated = await strategiesLib.updateStrategy(strategy.id, {
        isActive: true
      });
      expect(updated.isActive).toBe(true);
    });
  });

  describe('getStrategies', () => {
    it('should filter by protocol', async () => {
      await strategiesLib.createStrategy({
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy AAVE Filter',
        description: 'Test AAVE',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw']
      });

      await strategiesLib.createStrategy({
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy Uniswap Filter',
        description: 'Test Uniswap',
        protocol: 'UNISWAP',
        functions: ['exactInputSingle', 'exactOutputSingle']
      });

      const aaveStrategies = await strategiesLib.getStrategies({ protocol: 'AAVE' });
      const uniswapStrategies = await strategiesLib.getStrategies({ protocol: 'UNISWAP' });

      expect(aaveStrategies.some(s => s.protocol === 'AAVE')).toBe(true);
      expect(aaveStrategies.every(s => s.protocol === 'AAVE')).toBe(true);
      expect(uniswapStrategies.some(s => s.protocol === 'UNISWAP')).toBe(true);
      expect(uniswapStrategies.every(s => s.protocol === 'UNISWAP')).toBe(true);
    });

    it('should search by name and description', async () => {
      await strategiesLib.createStrategy({
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy Searchable',
        description: 'This has unique keywords',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw']
      });

      const results = await strategiesLib.getStrategies({ search: 'unique keywords' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].description).toContain('unique keywords');
    });
  });

  describe('isStrategyNameAvailable', () => {
    it('should return false for taken names', async () => {
      await strategiesLib.createStrategy({
        alphaGeneratorId: testGeneratorId,
        name: 'Test Strategy Taken',
        description: 'Test',
        protocol: 'AAVE',
        functions: ['supply', 'withdraw']
      });

      const available = await strategiesLib.isStrategyNameAvailable('Test Strategy Taken');
      expect(available).toBe(false);
    });

    it('should return true for available names', async () => {
      const available = await strategiesLib.isStrategyNameAvailable('Test Strategy Never Used 12345');
      expect(available).toBe(true);
    });
  });
});