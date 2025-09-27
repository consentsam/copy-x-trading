/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ElementDetails {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  href?: string;
  dataset?: Record<string, string>;
  position?: {
    x: number;
    y: number;
  };
}

export interface NetworkRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  timestamp: number;
}

export interface NetworkResponse {
  status: number;
  statusText: string;
  headers?: Record<string, string>;
  body?: any;
  timestamp: number;
  duration: number;
}

export interface ClickLogEntry {
  type: 'click';
  timestamp: string;
  sessionId: string;
  page: string;
  element: ElementDetails;
  viewport: {
    width: number;
    height: number;
  };
  correlationId?: string;
}

export interface APILogEntry {
  type: 'api';
  timestamp: string;
  sessionId: string;
  page: string;
  request: NetworkRequest;
  response?: NetworkResponse;
  error?: string;
  triggeredBy?: string;
  correlationId?: string;
}

export interface ErrorLogEntry {
  type: 'error';
  timestamp: string;
  sessionId: string;
  page: string;
  error: {
    message: string;
    stack?: string;
    source?: string;
  };
  correlationId?: string;
}

export type LogEntry = ClickLogEntry | APILogEntry | ErrorLogEntry;

export interface ActivityLoggerConfig {
  flushInterval?: number;      // ms, default 5000
  batchSize?: number;          // default 50 events
  sessionId?: string;          // auto-generate if not provided
  logEndpoint?: string;        // default '/api/activity-logs'
  captureNetworkBodies?: boolean; // default true
  captureErrors?: boolean;     // default true
  debug?: boolean;             // console output in dev
}

export interface ActivityLoggerStats {
  totalEvents: number;
  clickEvents: number;
  apiEvents: number;
  errorEvents: number;
  bufferSize: number;
  sessionStart: Date;
  lastFlush: Date | null;
}

export interface UseActivityLoggerReturn {
  stats: ActivityLoggerStats;
  forceFlush: () => Promise<void>;
  clearBuffer: () => void;
  pauseLogging: () => void;
  resumeLogging: () => void;
  isLogging: boolean;
}