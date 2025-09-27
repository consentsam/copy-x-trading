/**
 * Initialize backend logging service
 * This file should be imported at the top of any entry point
 */

import { LoggingService } from '@/src/services/LoggingService';

// Initialize logging as soon as this module is imported
const initializeLogging = () => {
  try {
    const logger = LoggingService.getInstance();
    console.log('✅ Backend logging service initialized successfully');
    console.log(`📝 Logs are being written to: ${logger.getLogFilePath()}`);

    // Log initial system information
    console.log('System Information:', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      cwd: process.cwd(),
      env: process.env.NODE_ENV || 'development'
    });

    return logger;
  } catch (error) {
    console.error('❌ Failed to initialize logging service:', error);
    return null;
  }
};

// Auto-initialize when imported
export const logger = initializeLogging();

// Export for manual initialization if needed
export { initializeLogging };