import fs from 'fs';
import path from 'path';
import util from 'util';

interface LogEntry {
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  timestamp: string;
  metadata?: any;
  stack?: string;
}

export class LoggingService {
  private static instance: LoggingService;
  private logStream: fs.WriteStream | null = null;
  private logDir: string;
  private logFile: string;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    debug: typeof console.debug;
  };

  private constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      debug: console.debug.bind(console)
    };

    // Set up log directory and file
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = this.createLogFileName();

    // Initialize logging
    this.initialize();
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  private createLogFileName(): string {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/T/, '-')
      .replace(/:/g, '')
      .replace(/\..+/, '')
      .replace(/-/g, '');

    return path.join(this.logDir, `backend-${timestamp}-session.log`);
  }

  private initialize(): void {
    try {
      // Create logs directory if it doesn't exist
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Create write stream for log file
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });

      // Write initialization message
      this.writeToFile({
        level: 'info',
        message: '=== Backend Logging Service Started ===',
        timestamp: new Date().toISOString(),
        metadata: {
          pid: process.pid,
          nodeVersion: process.version,
          env: process.env.NODE_ENV || 'development'
        }
      });

      // Intercept console methods
      this.interceptConsoleMethods();

      // Handle process exit
      process.on('beforeExit', () => this.cleanup());
      process.on('SIGINT', () => {
        this.cleanup();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        this.cleanup();
        process.exit(0);
      });

    } catch (error) {
      this.originalConsole.error('Failed to initialize LoggingService:', error);
    }
  }

  private interceptConsoleMethods(): void {
    const self = this;

    // Intercept console.log
    console.log = (...args: any[]) => {
      const message = this.formatArgs(args);
      self.writeToFile({
        level: 'info',
        message,
        timestamp: new Date().toISOString()
      });
      self.originalConsole.log(...args);
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      const message = this.formatArgs(args);
      const stack = args[0]?.stack || new Error().stack;
      self.writeToFile({
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        stack
      });
      self.originalConsole.error(...args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      const message = this.formatArgs(args);
      self.writeToFile({
        level: 'warn',
        message,
        timestamp: new Date().toISOString()
      });
      self.originalConsole.warn(...args);
    };

    // Intercept console.debug
    console.debug = (...args: any[]) => {
      const message = this.formatArgs(args);
      self.writeToFile({
        level: 'debug',
        message,
        timestamp: new Date().toISOString()
      });
      self.originalConsole.debug(...args);
    };
  }

  private formatArgs(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return util.inspect(arg, { depth: 3 });
        }
      }
      return String(arg);
    }).join(' ');
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.logStream || this.logStream.destroyed) {
      return;
    }

    try {
      // Write as JSONL (one JSON per line)
      const logLine = JSON.stringify(entry) + '\n';
      this.logStream.write(logLine);

      // Also write human-readable format for ERROR and WARN
      if (entry.level === 'error' || entry.level === 'warn') {
        const readableLog = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}\n`;
        if (entry.stack) {
          this.logStream.write(`Stack trace: ${entry.stack}\n`);
        }
      }
    } catch (error) {
      this.originalConsole.error('Failed to write to log file:', error);
    }
  }

  public logApiRequest(req: any, res: any): void {
    const start = Date.now();

    // Log request
    this.writeToFile({
      level: 'info',
      message: `API Request: ${req.method} ${req.url}`,
      timestamp: new Date().toISOString(),
      metadata: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: req.query,
        body: req.body
      }
    });

    // Override res.json to log response
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      const duration = Date.now() - start;

      this.writeToFile({
        level: 'info',
        message: `API Response: ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`,
        timestamp: new Date().toISOString(),
        metadata: {
          statusCode: res.statusCode,
          duration,
          responseData: data
        }
      });

      return originalJson(data);
    };
  }

  private cleanup(): void {
    try {
      this.writeToFile({
        level: 'info',
        message: '=== Backend Logging Service Stopped ===',
        timestamp: new Date().toISOString()
      });

      if (this.logStream && !this.logStream.destroyed) {
        this.logStream.end();
      }

      // Restore original console methods
      console.log = this.originalConsole.log;
      console.error = this.originalConsole.error;
      console.warn = this.originalConsole.warn;
      console.debug = this.originalConsole.debug;
    } catch (error) {
      this.originalConsole.error('Error during cleanup:', error);
    }
  }

  public getLogFilePath(): string {
    return this.logFile;
  }

  public getStats(): { logFile: string; logSize: number; startTime: Date } {
    const stats = fs.statSync(this.logFile);
    return {
      logFile: this.logFile,
      logSize: stats.size,
      startTime: stats.birthtime
    };
  }
}

// Export singleton instance
export const logger = LoggingService.getInstance();