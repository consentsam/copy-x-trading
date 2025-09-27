import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

// Create logger configuration with fallback for Next.js compatibility
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  // Avoid worker threads to prevent Next.js compatibility issues
  transport: undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
    log: (obj) => {
      // Enhanced formatting for development context
      if (isDevelopment && obj.context) {
        return { ...obj, context: `[${obj.context}]` };
      }
      return obj;
    },
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: (err) => {
      // Enhanced error serialization with fallback
      if (err instanceof Error) {
        return {
          message: err.message,
          stack: err.stack,
          type: err.constructor.name,
          ...err,
        };
      }
      return pino.stdSerializers.err(err);
    },
  },
});

export const createLogger = (context: string) => {
  return logger.child({ context });
};