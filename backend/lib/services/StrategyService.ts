import { BaseService } from './BaseService'
import { StrategyModel } from '@/app/models/Strategy'
import { ApiError } from '@/src/utils/errors'
import type { NewStrategy } from '@/db/schema/strategies-schema'

export class StrategyService extends BaseService {
  // Create a new strategy
  async createStrategy(data: {
    walletAddress: string
    name: string
    description?: string
    performanceMetrics?: any
  }) {
    try {
      this.validateWalletAddress(data.walletAddress)

      // Check if strategy name already exists for this wallet
      const existing = await StrategyModel.findByWallet(data.walletAddress)
      const nameExists = existing.some(s => s.name === data.name)

      if (nameExists) {
        throw new ApiError('Strategy name already exists for this wallet', 409)
      }

      const strategy = await StrategyModel.create(data as NewStrategy)
      this.log('Strategy created', { id: strategy.id, wallet: data.walletAddress })

      return this.formatResponse(strategy, 'Strategy created successfully')
    } catch (error) {
      this.handleError(error, 'createStrategy')
    }
  }

  // Get all strategies with optional filtering
  async getStrategies(params: {
    page?: number
    limit?: number
    isActive?: boolean
    walletAddress?: string
  }) {
    try {
      const { page = 1, limit = 20, isActive, walletAddress } = params
      const { offset } = this.paginate(page, limit)

      let strategies
      let total

      if (walletAddress) {
        this.validateWalletAddress(walletAddress)
        strategies = await StrategyModel.findByWallet(walletAddress)
        total = strategies.length
        strategies = strategies.slice(offset, offset + limit)
      } else {
        strategies = await StrategyModel.findAll(isActive)
        total = strategies.length
        strategies = strategies.slice(offset, offset + limit)
      }

      const meta = this.buildPaginationMeta(total, page, limit)
      return this.formatResponse(strategies, 'Strategies retrieved successfully', meta)
    } catch (error) {
      this.handleError(error, 'getStrategies')
    }
  }

  // Get strategy by ID
  async getStrategyById(id: string) {
    try {
      const strategy = await StrategyModel.findById(id)

      if (!strategy) {
        throw new ApiError('Strategy not found', 404)
      }

      return this.formatResponse(strategy, 'Strategy retrieved successfully')
    } catch (error) {
      this.handleError(error, 'getStrategyById')
    }
  }

  // Update strategy
  async updateStrategy(id: string, data: Partial<NewStrategy>) {
    try {
      // Check if strategy exists
      const existing = await StrategyModel.findById(id)
      if (!existing) {
        throw new ApiError('Strategy not found', 404)
      }

      // Validate wallet address if provided
      if (data.walletAddress) {
        this.validateWalletAddress(data.walletAddress)
      }

      const updated = await StrategyModel.update(id, data)
      this.log('Strategy updated', { id })

      return this.formatResponse(updated, 'Strategy updated successfully')
    } catch (error) {
      this.handleError(error, 'updateStrategy')
    }
  }

  // Deactivate strategy
  async deactivateStrategy(id: string, walletAddress: string) {
    try {
      this.validateWalletAddress(walletAddress)

      // Check if strategy exists and belongs to wallet
      const strategy = await StrategyModel.findById(id)
      if (!strategy) {
        throw new ApiError('Strategy not found', 404)
      }

      // Normalize addresses for comparison
      if (strategy.walletAddress?.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new ApiError('Unauthorized to modify this strategy', 403)
      }

      const result = await StrategyModel.softDelete(id)
      if (!result) {
        throw new ApiError('Failed to deactivate strategy', 500)
      }

      this.log('Strategy deactivated', { id, wallet: walletAddress })
      return this.formatResponse({ id }, 'Strategy deactivated successfully')
    } catch (error) {
      this.handleError(error, 'deactivateStrategy')
    }
  }

  // Get strategy performance metrics
  async getStrategyPerformance(id: string) {
    try {
      const strategy = await StrategyModel.findById(id)

      if (!strategy) {
        throw new ApiError('Strategy not found', 404)
      }

      // Calculate additional metrics based on trade history
      const performanceData = {
        ...strategy.strategyJSON,
        strategyId: id,
        lastUpdated: strategy.updatedAt,
      }

      return this.formatResponse(performanceData, 'Performance metrics retrieved successfully')
    } catch (error) {
      this.handleError(error, 'getStrategyPerformance')
    }
  }
}
