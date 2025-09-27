/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-rest-params */
import type {
  LogEntry,
  ActivityLoggerConfig,
  NetworkRequest,
  NetworkResponse,
  ElementDetails
} from '@/types/activity-logger.types';

class ActivityLoggerService {
  private buffer: LogEntry[] = [];
  private config: Required<ActivityLoggerConfig>;
  private sessionId: string;
  private flushTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = true;
  private originalFetch: typeof fetch;
  private correlationCounter: number = 0;
  private pendingCorrelations: Map<string, string> = new Map();

  constructor(config?: ActivityLoggerConfig) {
    this.config = {
      flushInterval: 5000,
      batchSize: 50,
      sessionId: this.generateSessionId(),
      logEndpoint: '/api/activity-logs',
      captureNetworkBodies: true,
      captureErrors: true,
      debug: process.env.NODE_ENV === 'development',
      ...config
    };
    
    this.sessionId = this.config.sessionId;
    this.originalFetch = window.fetch.bind(window);
    
    this.setupInterceptors();
    this.startFlushTimer();
    
    if (this.config.debug) {
      console.log('[ActivityLogger] Initialized with config:', this.config);
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getNextCorrelationId(): string {
    return `corr-${this.correlationCounter++}-${Date.now()}`;
  }

  private setupInterceptors(): void {
    this.setupClickInterceptor();
    this.setupNetworkInterceptor();
    if (this.config.captureErrors) {
      this.setupErrorInterceptor();
    }
  }

  private setupClickInterceptor(): void {
    document.addEventListener('click', (event) => {
      if (!this.isActive) return;

      const target = event.target as HTMLElement;
      const correlationId = this.getNextCorrelationId();
      
      // Store correlation for potential API calls
      this.pendingCorrelations.set('next-api-call', correlationId);
      setTimeout(() => {
        this.pendingCorrelations.delete('next-api-call');
      }, 1000); // Clear after 1 second if no API call

      const element: ElementDetails = {
        tag: target.tagName.toLowerCase(),
        id: target.id || undefined,
        className: target.className || undefined,
        text: target.innerText?.substring(0, 100) || undefined,
        href: (target as HTMLAnchorElement).href || undefined,
        dataset: target.dataset ? Object.fromEntries(Object.entries(target.dataset).filter(([_, v]) => v !== undefined) as [string, string][]) : undefined,
        position: {
          x: event.clientX,
          y: event.clientY
        }
      };

      this.logEvent({
        type: 'click',
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        page: window.location.pathname,
        element,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        correlationId
      });
    }, true);
  }

  private setupNetworkInterceptor(): void {
    // Skip intercepting if the activity logger is trying to send its own logs
    const isLoggerUrl = (url: string) => url.includes(this.config.logEndpoint);

    // Intercept fetch
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      if (!this.isActive) return this.originalFetch(...args);

      const [resource, init] = args;
      const url = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : resource.toString());

      // Skip logging for activity logger's own requests to prevent recursion
      if (isLoggerUrl(url)) {
        return this.originalFetch(...args);
      }

      const method = init?.method || 'GET';
      const startTime = Date.now();

      // Get correlation ID if this was triggered by a click
      const correlationId = this.pendingCorrelations.get('next-api-call');
      if (correlationId) {
        this.pendingCorrelations.delete('next-api-call');
      }

      const request: NetworkRequest = {
        url,
        method,
        headers: init?.headers as Record<string, string> || {},
        body: this.config.captureNetworkBodies ? init?.body : undefined,
        timestamp: startTime
      };

      try {
        const response = await this.originalFetch(...args);
        const duration = Date.now() - startTime;

        // Clone response to read body without consuming it
        const responseClone = response.clone();
        let responseBody: any;

        if (this.config.captureNetworkBodies) {
          try {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
              responseBody = await responseClone.json();
            } else {
              responseBody = await responseClone.text();
            }
          } catch (_e) {
            responseBody = '[Failed to parse response body]';
          }
        }

        const networkResponse: NetworkResponse = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          timestamp: Date.now(),
          duration
        };

        this.logEvent({
          type: 'api',
          timestamp: new Date().toISOString(),
          sessionId: this.sessionId,
          page: window.location.pathname,
          request,
          response: networkResponse,
          correlationId
        });

        return response;
      } catch (error) {
        this.logEvent({
          type: 'api',
          timestamp: new Date().toISOString(),
          sessionId: this.sessionId,
          page: window.location.pathname,
          request,
          error: error instanceof Error ? error.message : String(error),
          correlationId
        });

        throw error;
      }
    };

    // Intercept XMLHttpRequest - properly bind the original methods
    const OriginalXHR = XMLHttpRequest;
    const originalXHROpen = OriginalXHR.prototype.open;
    const originalXHRSend = OriginalXHR.prototype.send;
    const activityLogger = this;

    XMLHttpRequest.prototype.open = function(method: string, url: string, ...rest: any[]) {
      (this as any)._method = method;
      (this as any)._url = url;
      (this as any)._startTime = Date.now();

      // Skip logging for activity logger's own requests
      (this as any)._skipLogging = isLoggerUrl(url);

      return originalXHROpen.apply(this, arguments as any);
    };

    XMLHttpRequest.prototype.send = function(body?: any) {
      const xhr = this as any;

      // Skip logging for activity logger's own requests to prevent recursion
      if (xhr._skipLogging) {
        return originalXHRSend.call(this, body);
      }

      const correlationId = activityLogger.pendingCorrelations?.get('next-api-call');

      xhr.addEventListener('load', function() {
        if (!activityLogger.isActive || xhr._skipLogging) return;

        const duration = Date.now() - xhr._startTime;
        const request: NetworkRequest = {
          url: xhr._url,
          method: xhr._method,
          body: activityLogger.config?.captureNetworkBodies ? body : undefined,
          timestamp: xhr._startTime
        };

        const response: NetworkResponse = {
          status: xhr.status,
          statusText: xhr.statusText,
          body: activityLogger.config?.captureNetworkBodies ? xhr.responseText : undefined,
          timestamp: Date.now(),
          duration
        };

        activityLogger.logEvent({
          type: 'api',
          timestamp: new Date().toISOString(),
          sessionId: activityLogger.sessionId,
          page: window.location.pathname,
          request,
          response,
          correlationId
        });
      });

      xhr.addEventListener('error', function() {
        if (!activityLogger.isActive || xhr._skipLogging) return;

        const request: NetworkRequest = {
          url: xhr._url,
          method: xhr._method,
          body: activityLogger.config?.captureNetworkBodies ? body : undefined,
          timestamp: xhr._startTime
        };

        activityLogger.logEvent({
          type: 'api',
          timestamp: new Date().toISOString(),
          sessionId: activityLogger.sessionId,
          page: window.location.pathname,
          request,
          error: 'Network request failed',
          correlationId
        });
      });

      // Use call instead of apply with array to properly invoke the original
      return originalXHRSend.call(this, body);
    };
  }

  private setupErrorInterceptor(): void {
    window.addEventListener('error', (event) => {
      if (!this.isActive) return;

      this.logEvent({
        type: 'error',
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        page: window.location.pathname,
        error: {
          message: event.message,
          stack: event.error?.stack,
          source: `${event.filename}:${event.lineno}:${event.colno}`
        }
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      if (!this.isActive) return;

      this.logEvent({
        type: 'error',
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        page: window.location.pathname,
        error: {
          message: `Unhandled Promise Rejection: ${event.reason}`,
          stack: event.reason?.stack
        }
      });
    });
  }

  private logEvent(entry: LogEntry): void {
    if (this.config.debug) {
      console.log('[ActivityLogger]', entry.type, entry);
    }

    this.buffer.push(entry);

    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      // Use sendBeacon for reliability during page unload
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ logs, sessionId: this.sessionId })], {
          type: 'application/json'
        });
        navigator.sendBeacon(this.config.logEndpoint, blob);
      } else {
        // Fallback to fetch
        await this.originalFetch(this.config.logEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ logs, sessionId: this.sessionId })
        });
      }

      if (this.config.debug) {
        console.log(`[ActivityLogger] Flushed ${logs.length} events`);
      }
    } catch (error) {
      console.error('[ActivityLogger] Failed to flush logs:', error);
      // Re-add logs to buffer on failure
      this.buffer = [...logs, ...this.buffer];
    }
  }

  pause(): void {
    this.isActive = false;
  }

  resume(): void {
    this.isActive = true;
  }

  clear(): void {
    this.buffer = [];
  }

  getStats() {
    return {
      totalEvents: this.buffer.length,
      clickEvents: this.buffer.filter(e => e.type === 'click').length,
      apiEvents: this.buffer.filter(e => e.type === 'api').length,
      errorEvents: this.buffer.filter(e => e.type === 'error').length,
      bufferSize: this.buffer.length,
      sessionStart: new Date(parseInt(this.sessionId.split('-')[0])),
      lastFlush: null as Date | null
    };
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
    window.fetch = this.originalFetch;
  }
}

export default ActivityLoggerService;