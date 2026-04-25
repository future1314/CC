/**
 * Concurrency control utilities
 */
export class ConcurrencyLimiter {
    running = 0;
    queue = [];
    maxConcurrent;
    constructor(maxConcurrent = 5) {
        this.maxConcurrent = maxConcurrent;
    }
    async execute(fn) {
        return new Promise((resolve, reject) => {
            const wrappedFn = async () => {
                try {
                    this.running++;
                    const result = await fn();
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
                finally {
                    this.running--;
                    this.processQueue();
                }
            };
            if (this.running < this.maxConcurrent) {
                wrappedFn();
            }
            else {
                this.queue.push(wrappedFn);
            }
        });
    }
    processQueue() {
        while (this.running < this.maxConcurrent && this.queue.length > 0) {
            const fn = this.queue.shift();
            fn();
        }
    }
    getRunningCount() {
        return this.running;
    }
    getQueueLength() {
        return this.queue.length;
    }
}
export function createRateLimiter(maxRequests, interval) {
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
        execute: async (fn) => {
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
export function batchRequests(items, batchSize, processBatch) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    return batches.reduce((promise, batch) => {
        return promise.then(() => processBatch(batch));
    }, Promise.resolve());
}
