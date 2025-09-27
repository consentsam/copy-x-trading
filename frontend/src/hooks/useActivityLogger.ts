import { useEffect, useRef, useState, useCallback } from 'react';
import ActivityLoggerService from '@/services/activity-logger.service';
import type { 
  ActivityLoggerConfig, 
  ActivityLoggerStats, 
  UseActivityLoggerReturn 
} from '@/types/activity-logger.types';

export function useActivityLogger(config?: ActivityLoggerConfig): UseActivityLoggerReturn {
  const loggerRef = useRef<ActivityLoggerService | null>(null);
  const [stats, setStats] = useState<ActivityLoggerStats>({
    totalEvents: 0,
    clickEvents: 0,
    apiEvents: 0,
    errorEvents: 0,
    bufferSize: 0,
    sessionStart: new Date(),
    lastFlush: null
  });
  const [isLogging, setIsLogging] = useState(true);

  useEffect(() => {
    // Initialize logger only on client side
    if (typeof window !== 'undefined' && !loggerRef.current) {
      loggerRef.current = new ActivityLoggerService(config);
      
      // Update stats periodically
      const statsInterval = setInterval(() => {
        if (loggerRef.current) {
          setStats(loggerRef.current.getStats());
        }
      }, 1000);

      // Setup beforeunload handler for final flush
      const handleUnload = () => {
        if (loggerRef.current) {
          loggerRef.current.flush();
        }
      };
      
      window.addEventListener('beforeunload', handleUnload);

      return () => {
        clearInterval(statsInterval);
        window.removeEventListener('beforeunload', handleUnload);
        if (loggerRef.current) {
          loggerRef.current.destroy();
          loggerRef.current = null;
        }
      };
    }
  }, [config]);

  const forceFlush = useCallback(async (): Promise<void> => {
    if (loggerRef.current) {
      await loggerRef.current.flush();
      setStats(loggerRef.current.getStats());
    }
  }, []);

  const clearBuffer = useCallback((): void => {
    if (loggerRef.current) {
      loggerRef.current.clear();
      setStats(loggerRef.current.getStats());
    }
  }, []);

  const pauseLogging = useCallback((): void => {
    if (loggerRef.current) {
      loggerRef.current.pause();
      setIsLogging(false);
    }
  }, []);

  const resumeLogging = useCallback((): void => {
    if (loggerRef.current) {
      loggerRef.current.resume();
      setIsLogging(true);
    }
  }, []);

  return {
    stats,
    forceFlush,
    clearBuffer,
    pauseLogging,
    resumeLogging,
    isLogging
  };
}