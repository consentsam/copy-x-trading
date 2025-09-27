import { NextApiRequest, NextApiResponse } from 'next'
import { ApiError, errorHandler } from '@/src/utils/errors'

// Error handling middleware for Next.js API routes
export function withErrorHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res)
    } catch (error) {
      const errorResponse = errorHandler(error)
      res.status(errorResponse.statusCode).json(errorResponse)
    }
  }
}

// Method validation middleware
export function withMethodValidation(
  allowedMethods: string[],
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!allowedMethods.includes(req.method || '')) {
      res.setHeader('Allow', allowedMethods.join(', '))
      return res.status(405).json({
        isSuccess: false,
        message: `Method ${req.method} not allowed`,
      })
    }
    return handler(req, res)
  }
}

// Combined middleware wrapper
export function withMiddleware(
  allowedMethods: string[],
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return withErrorHandler(withMethodValidation(allowedMethods, handler))
}

// CORS middleware
export function withCORS(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Wallet-Address')
    res.setHeader('Access-Control-Allow-Credentials', 'true')

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }

    return handler(req, res)
  }
}

// Rate limiting storage (simple in-memory for now)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting middleware
export function withRateLimit(
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) {
  return (handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) => {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
      const key = `${ip}:${req.url}`
      const now = Date.now()

      const current = rateLimitStore.get(key)

      if (!current || current.resetTime < now) {
        rateLimitStore.set(key, {
          count: 1,
          resetTime: now + windowMs
        })
      } else if (current.count >= maxRequests) {
        return res.status(429).json({
          isSuccess: false,
          message: 'Too many requests, please try again later',
        })
      } else {
        current.count++
        rateLimitStore.set(key, current)
      }

      // Clean up old entries periodically
      if (Math.random() < 0.01) {
        for (const [k, v] of rateLimitStore.entries()) {
          if (v.resetTime < now) {
            rateLimitStore.delete(k)
          }
        }
      }

      return handler(req, res)
    }
  }
}

// Authentication middleware
export function withAuth(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const walletAddress = req.headers['x-wallet-address'] as string

    if (!walletAddress) {
      return res.status(401).json({
        isSuccess: false,
        message: 'Wallet address required',
      })
    }

    // Validate wallet address format
    const walletRegex = /^0x[a-fA-F0-9]{40}$/
    if (!walletRegex.test(walletAddress)) {
      return res.status(400).json({
        isSuccess: false,
        message: 'Invalid wallet address format',
      })
    }

    // Add wallet address to request for use in handlers
    (req as any).walletAddress = walletAddress

    return handler(req, res)
  }
}