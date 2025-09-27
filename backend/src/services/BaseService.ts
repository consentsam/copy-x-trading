import { db, pool } from '@/src/config/database'
import { ApiError } from '@/src/utils/errors'

export abstract class BaseService {
  protected db = db
  protected pool = pool

  // Generic error handler for service methods
  protected handleError(error: any, context: string): never {
    console.error(`Error in ${context}:`, error)

    if (error instanceof ApiError) {
      throw error
    }

    if (error.code === '23505') {
      throw new ApiError('Duplicate entry found', 409)
    }

    if (error.code === '23503') {
      throw new ApiError('Referenced entity not found', 404)
    }

    throw new ApiError(`Service error: ${error.message}`, 500)
  }

  // Pagination helper
  protected paginate(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit
    return { limit, offset }
  }

  // Build pagination metadata
  protected buildPaginationMeta(
    total: number,
    page: number,
    limit: number
  ) {
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    }
  }

  // Validate wallet address format
  protected validateWalletAddress(address: string): boolean {
    const walletRegex = /^0x[a-fA-F0-9]{40}$/
    if (!walletRegex.test(address)) {
      throw new ApiError('Invalid wallet address format', 400)
    }
    return true
  }

  // Validate positive number
  protected validatePositiveNumber(value: number, fieldName: string): boolean {
    if (value <= 0) {
      throw new ApiError(`${fieldName} must be a positive number`, 400)
    }
    return true
  }

  // Sanitize input to prevent SQL injection
  protected sanitizeInput(input: string): string {
    return input.replace(/[^\w\s.-]/gi, '')
  }

  // Format response with standard structure
  protected formatResponse<T>(
    data: T,
    message: string = 'Success',
    meta?: any
  ) {
    return {
      isSuccess: true, // Changed from success to isSuccess for consistency
      message,
      data,
      ...(meta && { meta }),
      timestamp: new Date().toISOString(),
    }
  }

  // Format error response
  protected formatErrorResponse(
    message: string,
    code: number = 500,
    details?: any
  ) {
    return {
      isSuccess: false, // Changed from success to isSuccess for consistency
      message,
      code,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
    }
  }

  // Check if entity exists
  protected async checkEntityExists(
    table: string,
    field: string,
    value: any
  ): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM ${table} WHERE ${field} = $1 LIMIT 1`,
      [value]
    )
    return result.rowCount > 0
  }

  // Log service action
  protected log(action: string, details?: any): void {
    console.log(`[${this.constructor.name}] ${action}`, details || '')
  }
}