/**
 * Advanced logging and monitoring utilities
 */

import { performance } from 'perf_hooks';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  stack?: string;
}

export class AdvancedLogger {
  private static instance: AdvancedLogger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private constructor() {}

  static getInstance(): AdvancedLogger {
    if (!AdvancedLogger.instance) {
      AdvancedLogger.instance = new AdvancedLogger();
    }
    return AdvancedLogger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error?.stack);
  }

  fatal(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, context, error?.stack);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, stack?: string): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      stack,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.printLog(entry);
  }

  private printLog(entry: LogEntry): void {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    const levelColors = ['\x1b[36m', '\x1b[32m', '\x1b[33m', '\x1b[31m', '\x1b[35m'];
    const resetColor = '\x1b[0m';

    const levelName = levelNames[entry.level];
    const levelColor = levelColors[entry.level];

    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const stackStr = entry.stack ? `\n${entry.stack}` : '';

    console.log(
      `${levelColor}[${levelName}]${resetColor} ${new Date(entry.timestamp).toISOString()} ${message}${contextStr}${stackStr}`
    );
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export function measurePerformance<T>(fn: () => T, label: string): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const duration = end - start;

  const logger = AdvancedLogger.getInstance();
  logger.info(`${label} took ${duration.toFixed(2)}ms`);

  return result;
}

export function createPerformanceMonitor(label: string): {
  start: () => void;
  end: () => number;
  log: () => void;
} {
  let startTime: number;
  let endTime: number;

  return {
    start: () => {
      startTime = performance.now();
    },
    end: () => {
      endTime = performance.now();
      return endTime - startTime;
    },
    log: () => {
      const duration = endTime - startTime;
      const logger = AdvancedLogger.getInstance();
      logger.info(`${label} took ${duration.toFixed(2)}ms`);
    },
  };
}