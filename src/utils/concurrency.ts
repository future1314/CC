/**
 * Concurrency control utilities
 */

export class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => Promise<void>> = [];
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedFn = async () => {
        try {
          this.running++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      };

      if (this.running < this.maxConcurrent) {
        wrappedFn();
      } else {
        this.queue.push(wrappedFn as () => Promise<void>);
      }
    });
  }

  private processQueue(): void {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const fn = this.queue.shift()!;
      fn();
    }
  }

  getRunningCount(): number {
    return this.running;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export function createRateLimiter(maxRequests: number, interval: number): {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  getRemaining: () => number;
} {
  let requests = 0;
  let lastReset = Date.now();

  const reset = () => {
    const now = Date.now();
    if (now - lastReset > interval) {
      requests = 0;
      lastReset = now;
    }
  };

  return {
    execute: async <T>(fn: () => Promise<T>): Promise<T> => {
      reset();
      if (requests >= maxRequests) {
        const waitTime = interval - (Date.now() - lastReset);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        reset();
      }

      requests++;
      return fn();
    },
    getRemaining: () => maxRequests - requests,
  };
}

export function batchRequests<T>(items: T[], batchSize: number, processBatch: (batch: T[]) => Promise<void>): Promise<void> {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return batches.reduce((promise, batch) => {
    return promise.then(() => processBatch(batch));
  }, Promise.resolve());
}