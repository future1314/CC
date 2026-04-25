/**
 * Advanced logging and monitoring utilities
 */
import { performance } from 'perf_hooks';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
})(LogLevel || (LogLevel = {}));
export class AdvancedLogger {
    static instance;
    logLevel = LogLevel.INFO;
    logs = [];
    maxLogs = 1000;
    constructor() { }
    static getInstance() {
        if (!AdvancedLogger.instance) {
            AdvancedLogger.instance = new AdvancedLogger();
        }
        return AdvancedLogger.instance;
    }
    setLogLevel(level) {
        this.logLevel = level;
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    error(message, error, context) {
        this.log(LogLevel.ERROR, message, context, error?.stack);
    }
    fatal(message, error, context) {
        this.log(LogLevel.FATAL, message, context, error?.stack);
    }
    log(level, message, context, stack) {
        if (level < this.logLevel)
            return;
        const entry = {
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
    printLog(entry) {
        const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
        const levelColors = ['\x1b[36m', '\x1b[32m', '\x1b[33m', '\x1b[31m', '\x1b[35m'];
        const resetColor = '\x1b[0m';
        const levelName = levelNames[entry.level];
        const levelColor = levelColors[entry.level];
        const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
        const stackStr = entry.stack ? `\n${entry.stack}` : '';
        console.log(`${levelColor}[${levelName}]${resetColor} ${new Date(entry.timestamp).toISOString()} ${message}${contextStr}${stackStr}`);
    }
    getLogs() {
        return [...this.logs];
    }
    clearLogs() {
        this.logs = [];
    }
}
export function measurePerformance(fn, label) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const duration = end - start;
    const logger = AdvancedLogger.getInstance();
    logger.info(`${label} took ${duration.toFixed(2)}ms`);
    return result;
}
export function createPerformanceMonitor(label) {
    let startTime;
    let endTime;
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
